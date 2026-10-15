import { Router } from "express";
import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail } from "./security.js";
import { schemas, validate } from "./validation.js";
import { createMailer } from "./mail.js";

const emailSchema = schemas.login.shape.email;
const purposeSchema = z.enum(["register", "reset"]);
const requestSchema = z
  .object({ email: emailSchema, purpose: purposeSchema })
  .strict();
const verifySchema = z
  .object({
    challengeId: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().regex(/^\d{6}$/),
    purpose: purposeSchema,
  })
  .strict();
const resetSchema = z
  .object({
    resetToken: z.string().regex(/^[a-f0-9]{64}$/),
    newPassword: schemas.password.shape.newPassword,
  })
  .strict();
const invalid = () =>
  fail(
    400,
    "The code is invalid, expired, or has reached its attempt limit. Request a new code.",
  );
const token = () => randomBytes(32).toString("hex");
export function emailAuthService(db, config) {
  const challenges = db.collection("lms_email_challenges"),
    limits = db.collection("lms_email_limits"),
    users = db.collection("lms_users");
  const mailer = config.mailer || createMailer(config.smtp);
  const hash = (value) =>
    createHmac("sha256", config.secret).update(value).digest("hex");
  const accountVersion = (user) =>
    hash(`${user._id}:${user.email}:${user.passwordHash}`);
  async function requestCode(values, mobile = false) {
    const { email, purpose } = validate(requestSchema, values);
    mailer.ready();
    const now = new Date(),
      key = hash(`${purpose}:${email}`);
    await limits
      .updateOne(
        { _id: key },
        {
          $setOnInsert: {
            count: 0,
            windowStart: new Date(0),
            lastSentAt: new Date(0),
            expiresAt: new Date(now.getTime() + 86400000),
          },
        },
        { upsert: true },
      )
      .catch((error) => {
        if (error.code !== 11000) throw error;
      });
    const expired = {
      $lte: ["$windowStart", new Date(now.getTime() - 900000)],
    };
    const allowed = await limits.findOneAndUpdate(
      {
        _id: key,
        lastSentAt: { $lte: new Date(now.getTime() - 60000) },
        $expr: { $or: [expired, { $lt: ["$count", 5] }] },
      },
      [
        {
          $set: {
            count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
            windowStart: { $cond: [expired, now, "$windowStart"] },
            lastSentAt: now,
            expiresAt: new Date(now.getTime() + 86400000),
          },
        },
      ],
      { returnDocument: "after" },
    );
    if (!allowed)
      fail(
        429,
        "Please wait 60 seconds between codes. At most 5 codes can be requested per email in 15 minutes.",
      );
    const user = await users.findOne({ email }),
      challengeId = token();
    const eligible =
      purpose === "register"
        ? !user
        : !!user &&
          user.status !== "suspended" &&
          (!mobile || user.role === "student");
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    await challenges.updateMany(
      {
        email,
        purpose,
        verifiedAt: { $exists: false },
        invalidatedAt: { $exists: false },
      },
      { $set: { invalidatedAt: now }, $unset: { codeHash: "" } },
    );
    await challenges.insertOne({
      _id: challengeId,
      email,
      purpose,
      codeHash: hash(`${challengeId}:${code}`),
      attempts: 0,
      ready: false,
      eligible,
      ...(purpose === "reset" && eligible
        ? { userId: user._id, accountVersion: accountVersion(user) }
        : {}),
      createdAt: now,
      codeExpiresAt: new Date(now.getTime() + 600000),
      expiresAt: new Date(now.getTime() + 1200000),
    });
    try {
      if (eligible) await mailer.sendOtp({ email, code, purpose });
      await challenges.updateOne(
        { _id: challengeId },
        { $set: { ready: true } },
      );
    } catch {
      await challenges.updateOne(
        { _id: challengeId },
        { $set: { invalidatedAt: new Date() }, $unset: { codeHash: "" } },
      );
      throw Object.assign(new Error("Email delivery failed."), {
        status: 503,
        publicMessage:
          "We could not send the email. Please try again later or contact the school administrator.",
      });
    }
    return {
      challengeId,
      expiresIn: 600,
      resendAfter: 60,
      message:
        purpose === "register"
          ? "If this email can be registered, a verification code has been sent. Check your inbox and spam folder."
          : "If an eligible account exists, a reset code has been sent. Check your inbox and spam folder.",
    };
  }
  async function verifyCode(values, mobile = false) {
    const { challengeId, code, purpose } = validate(verifySchema, values),
      now = new Date();
    const row = await challenges.findOneAndUpdate(
      {
        _id: challengeId,
        purpose,
        ready: true,
        invalidatedAt: { $exists: false },
        verifiedAt: { $exists: false },
        codeExpiresAt: { $gt: now },
        attempts: { $lt: 5 },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    if (
      !row ||
      !row.eligible ||
      !row.codeHash ||
      !timingSafeEqual(
        Buffer.from(row.codeHash, "hex"),
        Buffer.from(hash(`${challengeId}:${code}`), "hex"),
      )
    )
      invalid();
    if (purpose === "reset") {
      const user = await users.findOne({
        _id: row.userId,
        email: row.email,
        status: { $ne: "suspended" },
      });
      if (
        !user ||
        accountVersion(user) !== row.accountVersion ||
        (mobile && user.role !== "student")
      )
        invalid();
    }
    const proof = token();
    const claimed = await challenges.updateOne(
      {
        _id: challengeId,
        codeHash: row.codeHash,
        verifiedAt: { $exists: false },
        invalidatedAt: { $exists: false },
      },
      {
        $set: {
          verifiedAt: now,
          grantHash: hash(proof),
          grantExpiresAt: new Date(now.getTime() + 600000),
          expiresAt: new Date(now.getTime() + 600000),
        },
        $unset: { codeHash: "" },
      },
    );
    if (!claimed.modifiedCount) invalid();
    return {
      [purpose === "register" ? "verificationToken" : "resetToken"]: proof,
      expiresIn: 600,
      message: "Email verified.",
    };
  }
  async function consumeProof(proof, purpose, email, session) {
    if (typeof proof !== "string" || !/^[a-f0-9]{64}$/.test(proof))
      fail(400, "Verify your email before continuing.");
    const row = await challenges.findOneAndUpdate(
      {
        grantHash: hash(proof),
        purpose,
        ...(email ? { email } : {}),
        verifiedAt: { $exists: true },
        consumedAt: { $exists: false },
        invalidatedAt: { $exists: false },
        grantExpiresAt: { $gt: new Date() },
      },
      { $set: { consumedAt: new Date() }, $unset: { grantHash: "" } },
      { session, returnDocument: "before" },
    );
    if (!row)
      fail(
        400,
        "Email verification expired or was already used. Request a new code.",
      );
    return row;
  }
  async function resetPassword(values, mobile = false) {
    const data = validate(resetSchema, values),
      passwordHash = await bcrypt.hash(data.newPassword, 12),
      session = db.client.startSession();
    try {
      await session.withTransaction(async () => {
        const proof = await consumeProof(
          data.resetToken,
          "reset",
          null,
          session,
        );
        const user = await users.findOne(
          {
            _id: proof.userId,
            email: proof.email,
            status: { $ne: "suspended" },
          },
          { session },
        );
        if (
          !user ||
          accountVersion(user) !== proof.accountVersion ||
          (mobile && user.role !== "student")
        )
          fail(400, "This reset is no longer valid. Request a new code.");
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordHash,
              updatedAt: new Date(),
              emailVerifiedAt: new Date(),
            },
          },
          { session },
        );
        await db
          .collection("lms_sessions")
          .deleteMany({ userId: user._id }, { session });
        await challenges.updateMany(
          { email: user.email, purpose: "reset", _id: { $ne: proof._id } },
          {
            $set: { invalidatedAt: new Date() },
            $unset: { grantHash: "", codeHash: "" },
          },
          { session },
        );
        await db.collection("lms_admin_activity").insertOne(
          {
            actorId: user._id,
            actorName: user.name,
            action: "account.password-reset",
            targetId: user._id,
            targetName: user.name,
            detail:
              "Password reset after email verification; all sessions revoked.",
            createdAt: new Date(),
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return { message: "Password updated. Sign in with your new password." };
  }
  return { requestCode, verifyCode, consumeProof, resetPassword };
}
export function emailAuthRoutes(service, limiter) {
  const router = Router();
  for (const prefix of ["/auth", "/mobile/auth"]) {
    const mobile = prefix.includes("mobile");
    router.post(`${prefix}/email-otp/request`, limiter, async (req, res) =>
      res.json(await service.requestCode(req.body, mobile)),
    );
    router.post(`${prefix}/email-otp/verify`, limiter, async (req, res) =>
      res.json(await service.verifyCode(req.body, mobile)),
    );
    router.post(`${prefix}/reset-password`, limiter, async (req, res) =>
      res.json(await service.resetPassword(req.body, mobile)),
    );
  }
  return router;
}

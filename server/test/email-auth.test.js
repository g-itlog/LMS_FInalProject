import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";
import { invitationFields } from "../src/invitations.js";
import { createMailer, smtpConfig } from "../src/mail.js";

let mongo,
  database,
  app,
  mailFail = false;
const mails = [],
  secret = "test-only-email-secret-at-least-32-characters",
  origin = "http://localhost:5173",
  password = "Verified2026!";
const config = {
  secret,
  origins: [origin],
  production: false,
  apiRequestLimit: 10000,
  authRequestLimit: 10000,
  mailer: {
    ready() {},
    async sendOtp(mail) {
      if (mailFail) throw new Error("private SMTP password must not leak");
      mails.push(mail);
    },
  },
};
const post = (path, body, target = app) =>
  request(target).post(`/api${path}`).set("Origin", origin).send(body);
const codeFor = (email) => mails.filter((m) => m.email === email).at(-1)?.code;
const send = (email, purpose = "register", mobile = false) =>
  post(`${mobile ? "/mobile" : ""}/auth/email-otp/request`, { email, purpose });
const verify = (challenge, code, purpose = "register", mobile = false) =>
  post(`${mobile ? "/mobile" : ""}/auth/email-otp/verify`, {
    challengeId: challenge.challengeId,
    code,
    purpose,
  });
async function verified(email, purpose = "register", mobile = false) {
  const challenge = (await send(email, purpose, mobile).expect(200)).body;
  return (await verify(challenge, codeFor(email), purpose, mobile).expect(200))
    .body;
}
const release = () =>
  database.db
    .collection("lms_email_limits")
    .updateMany({}, { $set: { lastSentAt: new Date(0) } });
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  database = await connectDatabase(mongo.getUri(), "email_auth_test");
  app = createApp({ ...database, config });
});
after(async () => {
  await database?.client.close();
  await mongo?.stop();
});

test("SMTP config is private, missing delivery configuration fails closed, and registration cannot bypass verification", async () => {
  assert.equal(
    smtpConfig({ SMTP_PORT: "465", SMTP_SECURE: "true" }).secure,
    true,
  );
  assert.throws(() => createMailer({}).ready(), /not configured/);
  const noMail = createApp({
    ...database,
    config: { ...config, mailer: undefined },
  });
  const unavailable = await post(
    "/auth/email-otp/request",
    { email: "missing@example.test", purpose: "register" },
    noMail,
  ).expect(503);
  assert.match(unavailable.body.message, /not configured/);
  await post("/auth/register", {
    name: "No verification",
    email: "missing@example.test",
    password,
  }).expect(400);
  assert.equal(await database.db.collection("lms_users").countDocuments(), 0);
  await send("not an email").expect(400);
  await post("/auth/email-otp/request", {
    email: { $ne: "" },
    purpose: "reset",
  }).expect(400);
  await post("/auth/email-otp/request", {
    email: "valid@example.test",
    purpose: "unknown",
  }).expect(400);
});
test("registration proves email ownership before account creation, uses one-time hashed codes, and binds grants to email and purpose", async () => {
  const email = "verified@example.test",
    challenge = (await send("VERIFIED@example.test").expect(200)).body,
    code = codeFor(email);
  assert.match(code, /^\d{6}$/);
  assert.equal(challenge.code, undefined);
  assert.equal(
    await database.db.collection("lms_users").countDocuments({ email }),
    0,
  );
  const stored = await database.db
    .collection("lms_email_challenges")
    .findOne({ _id: challenge.challengeId });
  assert.notEqual(stored.codeHash, code);
  assert.equal(stored.code, undefined);
  await send(email).expect(429);
  await verify(challenge, code, "reset").expect(400);
  await verify(challenge, code === "000000" ? "111111" : "000000").expect(400);
  const proof = (await verify(challenge, code).expect(200)).body;
  await verify(challenge, code).expect(400);
  await post("/auth/register", {
    name: "Wrong email",
    email: "other@example.test",
    password,
    verificationToken: proof.verificationToken,
  }).expect(400);
  await post("/auth/reset-password", {
    resetToken: proof.verificationToken,
    newPassword: "Changed2026!",
  }).expect(400);
  const result = await post("/auth/register", {
    name: "Verified Student",
    email,
    password,
    verificationToken: proof.verificationToken,
  }).expect(201);
  assert.ok(result.body.user.emailVerifiedAt);
  assert.equal(result.body.user.passwordHash, undefined);
  assert.ok(result.headers["set-cookie"]);
  const user = await database.db.collection("lms_users").findOne({ email });
  assert.ok(await bcrypt.compare(password, user.passwordHash));
  await post("/auth/register", {
    name: "Replay",
    email: "replay@example.test",
    password,
    verificationToken: proof.verificationToken,
  }).expect(400);
});
test("five wrong guesses lock the challenge across app instances, expired codes and expired proofs fail", async () => {
  const email = "guesses@example.test",
    challenge = (await send(email).expect(200)).body,
    code = codeFor(email),
    wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await verify(challenge, wrong).expect(400);
  const restarted = createApp({ ...database, config });
  await post(
    "/auth/email-otp/verify",
    { challengeId: challenge.challengeId, code, purpose: "register" },
    restarted,
  ).expect(400);
  const expired = (await send("expired@example.test").expect(200)).body;
  await database.db
    .collection("lms_email_challenges")
    .updateOne(
      { _id: expired.challengeId },
      { $set: { codeExpiresAt: new Date(0) } },
    );
  await verify(expired, codeFor("expired@example.test")).expect(400);
  const proof = await verified("expired-proof@example.test");
  await database.db
    .collection("lms_email_challenges")
    .updateOne(
      { email: "expired-proof@example.test" },
      { $set: { grantExpiresAt: new Date(0) } },
    );
  await post("/auth/register", {
    name: "Expired Proof",
    email: "expired-proof@example.test",
    password,
    verificationToken: proof.verificationToken,
  }).expect(400);
});
test("resends invalidate old codes and database-backed cooldown/window limits persist across cold starts", async () => {
  const email = "resend@example.test",
    old = (await send(email).expect(200)).body,
    oldCode = codeFor(email);
  await release();
  const next = (await send(email).expect(200)).body;
  await verify(old, oldCode).expect(400);
  await verify(next, codeFor(email)).expect(200);
  for (let i = 0; i < 3; i++) {
    await release();
    await send(email).expect(200);
  }
  await release();
  await send(email).expect(429);
  const restarted = createApp({ ...database, config });
  await post(
    "/auth/email-otp/request",
    { email, purpose: "register" },
    restarted,
  ).expect(429);
});
test("SMTP failure does not create an account or usable code and returns no provider credentials", async () => {
  mailFail = true;
  const result = await send("delivery-failed@example.test").expect(503);
  mailFail = false;
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /private SMTP|password|codeHash/,
  );
  const row = await database.db
    .collection("lms_email_challenges")
    .findOne({ email: "delivery-failed@example.test" });
  assert.ok(row.invalidatedAt);
  assert.equal(row.codeHash, undefined);
  await verify({ challengeId: row._id }, "123456").expect(400);
  assert.equal(
    await database.db
      .collection("lms_users")
      .countDocuments({ email: row.email }),
    0,
  );
});
test("instructor registration atomically consumes its email proof and invitation only on successful account creation", async () => {
  const email = "faculty@example.test",
    proof = await verified(email),
    invite = {
      ...invitationFields("FacultyOneTimeCode2026"),
      label: "Faculty email test",
      active: true,
      useCount: 0,
      createdAt: new Date(),
    };
  await database.db.collection("lms_invitations").insertOne(invite);
  const body = {
    name: "Verified Instructor",
    email,
    password,
    role: "instructor",
    verificationToken: proof.verificationToken,
  };
  await post("/auth/register", { ...body, inviteCode: "wrong" }).expect(403);
  assert.equal(
    (
      await database.db
        .collection("lms_invitations")
        .findOne({ _id: invite._id })
    ).useCount,
    0,
  );
  await post("/auth/register", {
    ...body,
    inviteCode: "FacultyOneTimeCode2026",
  }).expect(201);
  assert.equal(
    (
      await database.db
        .collection("lms_invitations")
        .findOne({ _id: invite._id })
    ).useCount,
    1,
  );
});
test("reset responses do not disclose membership and mobile recovery rejects non-student and suspended accounts", async () => {
  const missing = (await send("unknown@example.test", "reset").expect(200))
    .body;
  assert.equal(codeFor("unknown@example.test"), undefined);
  const known = (await send("verified@example.test", "reset").expect(200)).body;
  assert.equal(missing.message, known.message);
  assert.deepEqual(Object.keys(missing), Object.keys(known));
  await send("faculty@example.test", "reset", true).expect(200);
  assert.equal(
    mails.filter(
      (m) => m.email === "faculty@example.test" && m.purpose === "reset",
    ).length,
    0,
  );
  await database.db.collection("lms_users").insertOne({
    name: "Suspended",
    email: "suspended@example.test",
    role: "student",
    status: "suspended",
    passwordHash: await bcrypt.hash(password, 4),
  });
  await send("suspended@example.test", "reset").expect(200);
  assert.equal(codeFor("suspended@example.test"), undefined);
  await verify(missing, "123456", "reset").expect(400);
});
test("reset verifies first, validates new passwords, updates the hash and revokes all web/mobile sessions without auto login", async () => {
  const email = "verified@example.test";
  await release();
  const web = request.agent(app);
  await web.post("/api/auth/login").send({ email, password }).expect(200);
  const mobile = (
    await post("/mobile/auth/login", { email, password }).expect(200)
  ).body.token;
  const proof = await verified(email, "reset", true);
  await web.get("/api/auth/me").expect(200);
  await post("/auth/reset-password", {
    resetToken: proof.resetToken,
    newPassword: "weak",
  }).expect(400);
  const result = await post("/mobile/auth/reset-password", {
    resetToken: proof.resetToken,
    newPassword: "Changed2026!",
  }).expect(200);
  assert.equal(result.body.token, undefined);
  assert.equal(result.headers["set-cookie"], undefined);
  await web.get("/api/auth/me").expect(401);
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${mobile}`)
    .expect(401);
  await post("/auth/login", { email, password }).expect(401);
  await post("/auth/login", { email, password: "Changed2026!" }).expect(200);
  await post("/auth/reset-password", {
    resetToken: proof.resetToken,
    newPassword: "Replay2026!",
  }).expect(400);
  const saved = await database.db.collection("lms_users").findOne({ email });
  assert.ok(await bcrypt.compare("Changed2026!", saved.passwordHash));
  assert.ok(!(await bcrypt.compare(password, saved.passwordHash)));
});
test("concurrent resets cannot reuse grants or overwrite a newer password and school logs contain no authentication secrets", async () => {
  const email = "verified@example.test";
  await release();
  const one = await verified(email, "reset");
  await release();
  const two = await verified(email, "reset");
  const results = await Promise.all([
    post("/auth/reset-password", {
      resetToken: one.resetToken,
      newPassword: "WinningOne2026!",
    }),
    post("/auth/reset-password", {
      resetToken: two.resetToken,
      newPassword: "WinningTwo2026!",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  const text = JSON.stringify(
    await database.db
      .collection("lms_admin_activity")
      .find({ action: "account.password-reset" })
      .toArray(),
  );
  assert.doesNotMatch(
    text,
    /resetToken|codeHash|grantHash|Verified2026|WinningOne|WinningTwo/,
  );
  for (const mail of mails) assert.ok(!text.includes(mail.code));
});

test("a code verified concurrently issues exactly one proof", async () => {
  const email = "concurrent-code@example.test",
    challenge = (await send(email).expect(200)).body;
  const results = await Promise.all([
    verify(challenge, codeFor(email)),
    verify(challenge, codeFor(email)),
  ]);
  assert.deepEqual(results.map((row) => row.status).sort(), [200, 400]);
  assert.equal(results.filter((row) => row.body.verificationToken).length, 1);
});

test("admin email changes clear verification and invalidate old-email recovery proofs", async () => {
  const user = await database.db
    .collection("lms_users")
    .findOne({ email: "verified@example.test" });
  await release();
  const old = await verified(user.email, "reset");
  await database.db
    .collection("lms_users")
    .insertOne({
      name: "Mailbox Administrator",
      email: "mail-admin@example.test",
      role: "admin",
      passwordHash: await bcrypt.hash(password, 4),
    });
  const admin = request.agent(app);
  await admin
    .post("/api/auth/login")
    .send({ email: "mail-admin@example.test", password })
    .expect(200);
  await admin
    .patch(`/api/admin/users/${user._id}`)
    .set("Origin", origin)
    .send({ email: "updated-mailbox@example.test" })
    .expect(200);
  assert.equal(
    (await database.db.collection("lms_users").findOne({ _id: user._id }))
      .emailVerifiedAt,
    undefined,
  );
  await post("/auth/reset-password", {
    resetToken: old.resetToken,
    newPassword: "OldMailbox2026!",
  }).expect(400);
  const fresh = await verified("updated-mailbox@example.test", "reset");
  await post("/auth/reset-password", {
    resetToken: fresh.resetToken,
    newPassword: "NewMailbox2026!",
  }).expect(200);
  assert.ok(
    (await database.db.collection("lms_users").findOne({ _id: user._id }))
      .emailVerifiedAt,
  );
});

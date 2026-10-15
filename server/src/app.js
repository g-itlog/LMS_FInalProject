import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  authenticate,
  cookieOptions,
  fail,
  publicUser,
  startSession,
} from "./security.js";
import { schemas, validate } from "./validation.js";
import { courseRoutes } from "./courses.js";
import { contentRoutes } from "./content.js";
import { ATTACHMENT_LIMIT_MESSAGE, MAX_ATTACHMENT_BYTES } from "./limits.js";

export function createApp({ db, bucket, config }) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, done) {
        done(null, !origin || config.origins.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.cookies.lms_session &&
      !req.headers.authorization?.startsWith("Bearer ")
    ) {
      if (!req.headers.origin || !config.origins.includes(req.headers.origin))
        return res.status(403).json({ message: "Request origin not allowed." });
    }
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again shortly." },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", async (req, res) => {
    await db.command({ ping: 1 });
    res.json({
      status: "ok",
      database: "connected",
      service: "classroom-lms-api",
      databaseName: db.databaseName,
      maxAttachmentBytes: MAX_ATTACHMENT_BYTES,
    });
  });
  const authLimit = rateLimit({
    windowMs: 900000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  const auth = authenticate(db, config);
  const users = db.collection("lms_users");
  async function register(req, res) {
    const data = validate(schemas.register, req.body);
    const mobile = req.path.startsWith("/api/mobile/");
    if (mobile && data.role !== "student")
      fail(403, "Only students can register in the mobile app.");
    if (data.role === "instructor") {
      const actual = Buffer.from(data.inviteCode || "");
      const expected = Buffer.from(config.inviteCode || "");
      if (
        !expected.length ||
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        fail(403, "A valid instructor invitation code is required.");
    }
    if (await users.findOne({ email: data.email }))
      fail(409, "An account with this email already exists.");
    const user = {
      name: data.name,
      email: data.email,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: data.role,
      bio: "",
      department: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await users.insertOne(user);
    user._id = result.insertedId;
    const token = await startSession(db, res, user, config, mobile);
    res
      .status(201)
      .json({ user: publicUser(user), ...(mobile ? { token } : {}) });
  }
  async function login(req, res) {
    const data = validate(schemas.login, req.body);
    const user = await users.findOne({ email: data.email });
    const matches = await bcrypt.compare(
      data.password,
      user?.passwordHash ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (!user || !matches) fail(401, "Email or password is incorrect.");
    const mobile = req.path.startsWith("/api/mobile/");
    if (mobile && user.role !== "student")
      fail(
        403,
        "The mobile app is for students only. Instructors can sign in on the web.",
      );
    const token = await startSession(db, res, user, config, mobile);
    res.json({ user: publicUser(user), ...(mobile ? { token } : {}) });
  }
  app.post(
    ["/api/auth/register", "/api/mobile/auth/register"],
    authLimit,
    register,
  );
  app.post(["/api/auth/login", "/api/mobile/auth/login"], authLimit, login);
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: publicUser(req.user) }),
  );
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db.collection("lms_sessions").deleteOne({ _id: req.sessionId });
    res.clearCookie("lms_session", cookieOptions(config.production));
    res.json({ message: "Signed out successfully." });
  });
  app.patch("/api/auth/profile", auth, async (req, res) => {
    const data = validate(schemas.profile, req.body);
    await users.updateOne(
      { _id: req.user._id },
      { $set: { ...data, updatedAt: new Date() } },
    );
    res.json({ user: publicUser({ ...req.user, ...data }) });
  });
  app.patch("/api/auth/password", auth, authLimit, async (req, res) => {
    const data = validate(schemas.password, req.body);
    if (!(await bcrypt.compare(data.currentPassword, req.user.passwordHash)))
      fail(400, "Current password is incorrect.");
    await users.updateOne(
      { _id: req.user._id },
      {
        $set: {
          passwordHash: await bcrypt.hash(data.newPassword, 12),
          updatedAt: new Date(),
        },
      },
    );
    await db.collection("lms_sessions").deleteMany({ userId: req.user._id });
    const mobile = !!req.headers.authorization;
    const token = await startSession(db, res, req.user, config, mobile);
    res.json({
      message: "Password changed. Other sessions have been signed out.",
      ...(mobile ? { token } : {}),
    });
  });
  app.use("/api", auth, courseRoutes(db, bucket), contentRoutes(db, bucket));
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "API endpoint not found." }),
  );
  const clientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../client/dist",
  );
  if (existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(clientDist, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error.code === 11000
        ? 409
        : error.code === "LIMIT_FILE_SIZE"
          ? 413
          : error.status || (error.name === "MulterError" ? 400 : 500);
    if (status >= 500)
      console.error("Request failed:", error.name, error.code || "");
    res.status(status).json({
      message:
        error.code === 11000
          ? "This record already exists. Use a different email or course code."
          : status === 413
            ? ATTACHMENT_LIMIT_MESSAGE
            : status >= 500
              ? "Something went wrong. Please try again."
              : error.message,
    });
  });
  return app;
}

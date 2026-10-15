import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";

export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function id(value) {
  if (!/^[a-f\d]{24}$/i.test(String(value))) fail(400, "Invalid record ID");
  return new ObjectId(value);
}
export function publicUser(user) {
  const { passwordHash, password, ...safe } = user;
  return safe;
}
export const cookieOptions = (production) => ({
  httpOnly: true,
  secure: production,
  sameSite: "lax",
  path: "/",
});
export async function startSession(db, res, user, config, mobile = false) {
  const sessionId = randomUUID();
  await db
    .collection("lms_sessions")
    .insertOne({
      _id: sessionId,
      userId: user._id,
      expiresAt: new Date(Date.now() + 86400000),
    });
  const token = jwt.sign(
    { sub: user._id.toString(), jti: sessionId },
    config.secret,
    {
      algorithm: "HS256",
      expiresIn: "1d",
      issuer: "classroom-lms",
      audience: "classroom-app",
    },
  );
  if (!mobile)
    res.cookie("lms_session", token, {
      ...cookieOptions(config.production),
      maxAge: 86400000,
    });
  return mobile ? token : undefined;
}
export function authenticate(db, config) {
  return async (req, res, next) => {
    try {
      const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null;
      const token = bearer || req.cookies.lms_session;
      if (!token)
        return res.status(401).json({ message: "Please sign in to continue." });
      let claims;
      try {
        claims = jwt.verify(token, config.secret, {
          algorithms: ["HS256"],
          issuer: "classroom-lms",
          audience: "classroom-app",
        });
      } catch {
        return res
          .status(401)
          .json({ message: "Your session expired. Please sign in again." });
      }
      const session = await db
        .collection("lms_sessions")
        .findOne({
          _id: claims.jti,
          userId: id(claims.sub),
          expiresAt: { $gt: new Date() },
        });
      if (!session)
        return res
          .status(401)
          .json({ message: "Your session expired. Please sign in again." });
      req.user = await db
        .collection("lms_users")
        .findOne({ _id: id(claims.sub) });
      if (!req.user)
        return res.status(401).json({ message: "Account unavailable." });
      if (bearer && req.user.role !== "student")
        return res
          .status(403)
          .json({ message: "Mobile access is available to students only." });
      req.sessionId = claims.jti;
      next();
    } catch (error) {
      next(error);
    }
  };
}
export function role(required) {
  return (req, res, next) =>
    req.user.role === required
      ? next()
      : res
          .status(403)
          .json({ message: "This action is not available for your role." });
}

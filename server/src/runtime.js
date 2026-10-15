import { connectDatabase } from "./database.js";
import { createApp } from "./app.js";
import { smtpConfig } from "./mail.js";

function removeVercelRouteParameter(req) {
  // /api/:path* -> /api reserves `path` as routing metadata, not an API filter.
  // Vercel can expose it in the URL and in its already-parsed query object.
  const separator = req.url.indexOf("?");
  if (separator !== -1) {
    const query = new URLSearchParams(req.url.slice(separator + 1));
    if (query.has("path")) {
      query.delete("path");
      const remaining = query.toString();
      req.url =
        req.url.slice(0, separator) + (remaining ? `?${remaining}` : "");
    }
  }
  if (req.query && typeof req.query === "object") delete req.query.path;
}

export function readRuntimeConfig(env = process.env) {
  const secret = env.JWT_SECRET || env.SECRET_KEY;
  if (!env.MONGO_URL || !secret || secret.length < 32)
    throw new Error(
      "Set MONGO_URL and a JWT_SECRET of at least 32 characters.",
    );
  const production = env.NODE_ENV === "production" || env.VERCEL === "1";
  const origins = (
    env.CLIENT_ORIGINS ||
    (production
      ? ""
      : "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
  )
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  // Vercel supplies these hosts. Never trust a request's Host to grant origins.
  if (env.VERCEL === "1") {
    for (const host of [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]) {
      if (host && /^[a-z0-9.-]+$/i.test(host)) origins.push(`https://${host}`);
    }
  }
  return {
    secret,
    smtp: smtpConfig(env),
    production,
    inviteCode: env.INSTRUCTOR_INVITE_CODE,
    trustProxy: env.TRUST_PROXY === "1" || env.VERCEL === "1",
    origins: [...new Set(origins)],
  };
}

export function createServerlessHandler({
  env = process.env,
  connect = connectDatabase,
  makeApp = createApp,
} = {}) {
  let application;
  async function initialize() {
    const config = readRuntimeConfig(env);
    const database = await connect(
      env.MONGO_URL,
      env.MONGO_DB_NAME || "classroom_lms",
      {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 60000,
      },
    );
    try {
      return makeApp({ ...database, config });
    } catch (error) {
      await database.client.close();
      throw error;
    }
  }
  return async function handler(req, res) {
    try {
      if (env.VERCEL === "1") removeVercelRouteParameter(req);
      // Concurrent cold-start requests share initialization and the Mongo pool.
      application ||= initialize().catch((error) => {
        application = undefined;
        throw error;
      });
      const app = await application;
      return app(req, res);
    } catch (error) {
      console.error(`API initialization failed (${error.name}).`);
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Retry-After", "10");
      res.end(
        JSON.stringify({
          message:
            "API unavailable. Check the deployment database connection and environment settings.",
        }),
      );
    }
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDatabase } from "../src/database.js";
import { createServerlessHandler, readRuntimeConfig } from "../src/runtime.js";

const env = {
  MONGO_URL: "mongodb://test-only",
  MONGO_DB_NAME: "lms_serverless_test",
  JWT_SECRET: "test-only-serverless-secret-at-least-32-characters",
  VERCEL: "1",
  VERCEL_URL: "preview-test.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "knowhere-test.vercel.app",
};
const simpleApp = () => (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end('{"status":"ok"}');
};

test("Vercel runtime permits only configured and platform-provided origins", () => {
  const config = readRuntimeConfig({
    ...env,
    CLIENT_ORIGINS: "https://school.example/,https://school.example",
  });
  assert.equal(config.production, true);
  assert.equal(config.trustProxy, true);
  assert.deepEqual(config.origins, [
    "https://school.example",
    "https://knowhere-test.vercel.app",
    "https://preview-test.vercel.app",
  ]);
  assert.throws(() => readRuntimeConfig({ ...env, JWT_SECRET: "short" }));
});

test("warm and concurrent function requests share one database initialization", async () => {
  let connections = 0;
  const handler = createServerlessHandler({
    env,
    connect: async () => {
      connections++;
      return {};
    },
    makeApp: simpleApp,
  });
  await Promise.all([
    request(handler).get("/api/health").expect(200),
    request(handler).get("/api/health").expect(200),
  ]);
  await request(handler).get("/api/health").expect(200);
  assert.equal(connections, 1);
});

test("a failed cold start returns safe JSON and a later request can reconnect", async () => {
  let attempts = 0;
  const handler = createServerlessHandler({
    env,
    connect: async () => {
      if (++attempts === 1) throw new Error("private connection details");
      return {};
    },
    makeApp: simpleApp,
  });
  const failure = await request(handler).get("/api/health").expect(503);
  assert.equal(failure.headers["cache-control"], "no-store");
  assert.doesNotMatch(
    failure.text,
    /private connection details|test-only-serverless-secret/,
  );
  await request(handler).get("/api/health").expect(200);
  assert.equal(attempts, 2);
});

test("application initialization failure closes its database connection", async () => {
  let closed = 0;
  const handler = createServerlessHandler({
    env,
    connect: async () => ({ client: { close: async () => closed++ } }),
    makeApp: () => {
      throw new Error("startup failed");
    },
  });
  await request(handler).get("/api/health").expect(503);
  assert.equal(closed, 1);
});

test("the function handles real Atlas-compatible database auth, secure cookies, routes, and logout", async () => {
  const mongo = await MongoMemoryServer.create();
  let database,
    connections = 0;
  try {
    const handler = createServerlessHandler({
      env: { ...env, MONGO_URL: mongo.getUri() },
      connect: async (...args) => {
        connections++;
        database = await connectDatabase(...args);
        return database;
      },
    });
    const origin = "https://knowhere-test.vercel.app";
    const health = await request(handler).get("/api/health").expect(200);
    assert.equal(health.body.database, "connected");
    assert.equal(health.body.maxAttachmentBytes, 3 * 1024 * 1024);
    const signup = await request(handler)
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Hosted Student",
        email: "hosted@example.test",
        password: "Password2026!",
      })
      .expect(201);
    assert.match(signup.headers["set-cookie"][0], /HttpOnly/);
    assert.match(signup.headers["set-cookie"][0], /Secure/);
    assert.match(signup.headers["set-cookie"][0], /SameSite=Lax/);
    const cookie = signup.headers["set-cookie"][0].split(";")[0];
    await request(handler)
      .get("/api/dashboard")
      .set("Cookie", cookie)
      .expect(200);
    await request(handler)
      .patch("/api/auth/profile")
      .set("Cookie", cookie)
      .set("Origin", "https://untrusted.test")
      .send({ name: "Forged Student" })
      .expect(403);
    await request(handler)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .expect(200);
    await request(handler)
      .get("/api/dashboard")
      .set("Cookie", cookie)
      .expect(401);
    await request(handler).get("/api/does-not-exist").expect(401);
    assert.equal(connections, 1);
  } finally {
    await database?.client.close();
    await mongo.stop();
  }
});

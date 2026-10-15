import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcryptjs";
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

test("Vercel routing metadata is removed from URLs and pre-parsed queries without changing filters", async () => {
  const handler = createServerlessHandler({
    env,
    connect: async () => ({}),
    makeApp: () => (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ url: req.url, query: req.query }));
    },
  });
  const original =
    "/api/admin/users?path=admin%2Fusers&page=2&search=Data%20%26%20AI%3F&role=instructor&status=active&tag=one&tag=two&unexpected=keep";
  const result = await request(handler).get(original).expect(200);
  const url = new URL(result.body.url, "http://localhost");
  assert.equal(url.pathname, "/api/admin/users");
  assert.equal(url.searchParams.has("path"), false);
  assert.equal(url.searchParams.get("search"), "Data & AI?");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("role"), "instructor");
  assert.equal(url.searchParams.get("status"), "active");
  assert.equal(url.searchParams.get("unexpected"), "keep");
  assert.deepEqual(url.searchParams.getAll("tag"), ["one", "two"]);

  for (const metadata of ["admin/users", ["admin", "users"]]) {
    const bridge = (req, res) => {
      // The platform may expose the capture separately from the original URL.
      req.query = {
        path: metadata,
        search: "Alex Rivera",
        role: "student",
        page: "1",
      };
      return handler(req, res);
    };
    const parsed = await request(bridge)
      .get("/api/admin/users?search=Alex%20Rivera")
      .expect(200);
    assert.equal(parsed.body.url, "/api/admin/users?search=Alex%20Rivera");
    assert.deepEqual(parsed.body.query, {
      search: "Alex Rivera",
      role: "student",
      page: "1",
    });
  }
  const captureOnly = await request(handler)
    .get("/api/admin/activity?path=admin%2Factivity")
    .expect(200);
  assert.equal(captureOnly.body.url, "/api/admin/activity");
});

test("ordinary Node requests retain their original query parameters", async () => {
  const handler = createServerlessHandler({
    env: { ...env, VERCEL: "0" },
    connect: async () => ({}),
    makeApp: () => (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ url: req.url, query: req.query }));
    },
  });
  const bridge = (req, res) => {
    req.query = { path: "caller-value", page: "1" };
    return handler(req, res);
  };
  const url = "/api/admin/users?path=caller-value&page=1";
  const result = await request(bridge).get(url).expect(200);
  assert.equal(result.body.url, url);
  assert.deepEqual(result.body.query, { path: "caller-value", page: "1" });
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

test("rewritten admin directory requests preserve filtering, strict validation, and role protection", async () => {
  const mongo = await MongoMemoryServer.create();
  let database;
  try {
    database = await connectDatabase(mongo.getUri(), "rewritten_admin_test");
    const password = "Password2026!";
    const passwordHash = await bcrypt.hash(password, 4);
    for (const role of ["admin", "student", "instructor"])
      await database.db
        .collection("lms_users")
        .insertOne({
          name: `Hosted ${role}`,
          email: `${role}@rewrite-test.edu`,
          passwordHash,
          role,
          status: "active",
          createdAt: new Date(),
        });
    const handler = createServerlessHandler({
      env,
      connect: async () => database,
    });
    const bridge = (req, res) => {
      // Model both representations produced by the hosting bridge/rewrite.
      const url = new URL(req.url, "http://localhost");
      url.searchParams.set("path", url.pathname.slice(5));
      req.url = url.pathname + url.search;
      req.query = Object.fromEntries(url.searchParams);
      return handler(req, res);
    };
    const origin = "https://knowhere-test.vercel.app";
    const login = async (role) => {
      const result = await request(bridge)
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: `${role}@rewrite-test.edu`, password })
        .expect(200);
      return result.headers["set-cookie"][0].split(";")[0];
    };
    const adminCookie = await login("admin");
    const studentCookie = await login("student");
    const instructorCookie = await login("instructor");
    const users = await request(bridge)
      .get("/api/admin/users?page=1&search=Hosted&role=student&status=active")
      .set("Cookie", adminCookie)
      .expect(200);
    assert.equal(users.body.total, 1);
    assert.equal(users.body.items[0].email, "student@rewrite-test.edu");
    assert.equal(users.body.items[0].passwordHash, undefined);
    const empty = await request(bridge)
      .get("/api/admin/users?search=does-not-exist&role=all&status=all&page=1")
      .set("Cookie", adminCookie)
      .expect(200);
    assert.equal(empty.body.total, 0);
    for (const endpoint of ["users", "courses", "activity", "invitations"]) {
      await request(bridge)
        .get(`/api/admin/${endpoint}?search=&page=1`)
        .set("Cookie", adminCookie)
        .expect(200);
      await request(bridge).get(`/api/admin/${endpoint}`).expect(401);
      await request(bridge)
        .get(`/api/admin/${endpoint}`)
        .set("Cookie", studentCookie)
        .expect(403);
      await request(bridge)
        .get(`/api/admin/${endpoint}`)
        .set("Cookie", instructorCookie)
        .expect(403);
      const invalid = await request(bridge)
        .get(`/api/admin/${endpoint}?unexpected=invalid`)
        .set("Cookie", adminCookie)
        .expect(400);
      assert.match(invalid.body.message, /unexpected/);
      await request(bridge)
        .get(`/api/admin/${endpoint}?page=0`)
        .set("Cookie", adminCookie)
        .expect(400);
    }
    // Routing cleanup must never remove invalid body fields from write requests.
    await request(bridge)
      .post("/api/admin/users")
      .set("Cookie", adminCookie)
      .set("Origin", origin)
      .send({
        name: "Invalid Body",
        email: "invalid@rewrite-test.edu",
        password,
        role: "student",
        path: "injected",
      })
      .expect(400);
    for (const cookie of [adminCookie, studentCookie, instructorCookie])
      await request(bridge)
        .post("/api/auth/logout")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .expect(200);
  } finally {
    await database?.client.close();
    await mongo.stop();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { connectDatabase } from "../src/database.js";
import { createApp } from "../src/app.js";

test("private admin command creates a working account, keeps its password out of output, and never overwrites credentials", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const cache = path.join(root, ".cache");
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(path.join(cache, "admin-command-"));
  const credentials = path.join(directory, ".local-admin-credentials.txt");
  const second = path.join(directory, "second-credentials.txt");
  const mongo = await MongoMemoryServer.create();
  let database;
  try {
    const run = promisify(execFile);
    const options = {
      cwd: root,
      env: {
        ...process.env,
        MONGO_URL: mongo.getUri(),
        MONGO_DB_NAME: "admin_command_test",
      },
      windowsHide: true,
    };
    const args = [
      "server/scripts/create-admin.js",
      "--email",
      "private-admin@example.edu",
      "--name",
      "Private Administrator",
      "--credentials-file",
      credentials,
    ];
    const result = await run(process.execPath, args, options);
    const text = await readFile(credentials, "utf8");
    const password = text.match(/^Password: (.+)$/m)?.[1];
    assert.ok(password && password.length >= 32);
    assert.ok(
      !result.stdout.includes(password) && !result.stderr.includes(password),
    );
    database = await connectDatabase(mongo.getUri(), "admin_command_test");
    const user = await database.db
      .collection("lms_users")
      .findOne({ email: "private-admin@example.edu" });
    assert.equal(user.role, "admin");
    assert.notEqual(user.passwordHash, password);
    const app = createApp({
      ...database,
      config: {
        secret: "test-bootstrap-secret-at-least-32-characters",
        origins: [],
        production: false,
      },
    });
    const admin = request.agent(app);
    await admin
      .post("/api/auth/login")
      .send({ email: user.email, password })
      .expect(200);
    await admin.get("/api/admin/overview").expect(200);
    await request(app)
      .post("/api/mobile/auth/login")
      .send({ email: user.email, password })
      .expect(403);
    await assert.rejects(run(process.execPath, args, options));
    assert.equal(await readFile(credentials, "utf8"), text);
    const duplicateArgs = [...args];
    duplicateArgs[duplicateArgs.length - 1] = second;
    await assert.rejects(run(process.execPath, duplicateArgs, options));
    assert.equal(
      await database.db
        .collection("lms_users")
        .countDocuments({ role: "admin" }),
      1,
    );
    await assert.rejects(readFile(second, "utf8"), { code: "ENOENT" });
  } finally {
    await database?.client.close();
    await mongo.stop();
    await unlink(credentials).catch(() => {});
    await unlink(second).catch(() => {});
    await rmdir(directory);
  }
});

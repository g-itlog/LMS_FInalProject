import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createServer } from "node:http";
import { createServerlessHandler } from "../src/runtime.js";
import { connectDatabase } from "../src/database.js";
import { seedDemo } from "./seed-data.js";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const database = await connectDatabase(mongo.getUri(), "classroom_test");
await seedDemo(database.db, "Classroom2026!");
// Test-only administrator; never added by the production demo seed.
await database.db.collection("lms_users").insertOne({
  name: "Morgan Reyes",
  email: "admin@classroom.test",
  role: "admin",
  status: "active",
  passwordHash: await bcrypt.hash("Classroom2026!", 4),
  bio: "",
  department: "Administration",
  createdAt: new Date(),
  updatedAt: new Date(),
});
const config = {
  secret: "test-only-secret-key-with-at-least-32-characters",
  inviteCode: "test-instructor-code",
  production: false,
  origins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
  ],
};
const handler = createServerlessHandler({
  env: {
    MONGO_URL: mongo.getUri(),
    MONGO_DB_NAME: "classroom_test",
    JWT_SECRET: config.secret,
    INSTRUCTOR_INVITE_CODE: config.inviteCode,
    CLIENT_ORIGINS: config.origins.join(","),
    NODE_ENV: "test",
  },
  connect: async () => database,
  // All browser tests share a loopback IP; production keeps its 180/min limit.
  makeApp: (options) =>
    createApp({
      ...options,
      config: { ...options.config, apiRequestLimit: 5000 },
    }),
});
const server = createServer(handler).listen(8001, "127.0.0.1", () =>
  console.log(
    "Isolated demo ready at http://127.0.0.1:8001 (no Atlas records used)",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await database.client.close();
      await mongo.stop();
      process.exit(0);
    }),
  );

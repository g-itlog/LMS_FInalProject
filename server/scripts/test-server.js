import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase } from "../src/database.js";
import { seedDemo } from "./seed-data.js";
const mongo = await MongoMemoryServer.create();
const database = await connectDatabase(mongo.getUri(), "classroom_test");
await seedDemo(database.db, "Classroom2026!");
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
const app = createApp({ ...database, config });
const server = app.listen(8001, "127.0.0.1", () =>
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

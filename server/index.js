import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "./src/database.js";
import { createApp } from "./src/app.js";

dotenv.config({
  path: fileURLToPath(new URL(".env", import.meta.url)),
  quiet: true,
});
const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
if (!process.env.MONGO_URL || !secret || secret.length < 32) {
  console.error(
    "Set MONGO_URL and a JWT_SECRET of at least 32 characters in server/.env.",
  );
  process.exit(1);
}
try {
  const database = await connectDatabase(
    process.env.MONGO_URL,
    process.env.MONGO_DB_NAME || "classroom_lms",
  );
  const config = {
    secret,
    inviteCode: process.env.INSTRUCTOR_INVITE_CODE,
    production: process.env.NODE_ENV === "production",
    trustProxy: process.env.TRUST_PROXY === "1",
    origins: (
      process.env.CLIENT_ORIGINS ||
      "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    )
      .split(",")
      .map((s) => s.trim()),
  };
  const app = createApp({ ...database, config });
  const server = app.listen(Number(process.env.PORT) || 8000, "0.0.0.0", () =>
    console.log(`Classroom LMS API ready on port ${process.env.PORT || 8000}`),
  );
  server.once("error", async (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${process.env.PORT || 8000} is already in use. If npm run dev or another LMS server is running, use that server or stop it with Ctrl+C before starting another.`,
      );
    } else {
      console.error(`Server could not start (${error.code || error.name}).`);
    }
    await database.client.close();
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close(async () => {
        await database.client.close();
        process.exit(0);
      });
    });
} catch (error) {
  console.error(
    `Database connection failed (${error.name}). Check your Atlas credentials, network access list, and MONGO_URL.`,
  );
  process.exit(1);
}

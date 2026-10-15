import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "./src/database.js";
import { createApp } from "./src/app.js";
import { readRuntimeConfig } from "./src/runtime.js";

dotenv.config({
  path: fileURLToPath(new URL(".env", import.meta.url)),
  quiet: true,
});
try {
  const config = readRuntimeConfig();
  const database = await connectDatabase(
    process.env.MONGO_URL,
    process.env.MONGO_DB_NAME || "classroom_lms",
  );
  console.log(
    `MongoDB connected successfully (database: ${database.db.databaseName}).`,
  );
  const app = createApp({ ...database, config });
  const server = app.listen(Number(process.env.PORT) || 8000, "0.0.0.0", () => {
    console.log(
      `Knowhere to Grow API ready at http://localhost:${process.env.PORT || 8000}`,
    );
    console.log(
      `Database health: http://localhost:${process.env.PORT || 8000}/api/health`,
    );
    console.log("Keep this terminal open. Press Ctrl+C to stop this server.");
  });
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

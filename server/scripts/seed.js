import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "../src/database.js";
import { seedDemo } from "./seed-data.js";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
let database;
try {
  database = await connectDatabase(
    process.env.MONGO_URL,
    process.env.MONGO_DB_NAME || "classroom_lms",
  );
  await seedDemo(database.db, process.env.DEMO_PASSWORD);
  console.log(
    "Demo records ready. Existing users and courses were preserved. See your private local credentials file.",
  );
} catch (error) {
  console.error(
    `Seed failed (${error.name}): check connection and DEMO_PASSWORD configuration.`,
  );
  process.exitCode = 1;
} finally {
  await database?.client.close();
}

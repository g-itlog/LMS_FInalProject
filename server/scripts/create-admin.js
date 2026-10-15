import dotenv from "dotenv";
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import bcrypt from "bcryptjs";
import { connectDatabase } from "../src/database.js";
import { schemas, validate } from "../src/validation.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const defaultCredentialsPath = fileURLToPath(
  new URL("../../.local-admin-credentials.txt", import.meta.url),
);

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      help: { type: "boolean" },
      "credentials-file": { type: "string" },
    },
  });
  if (values.help || !values.email || !values.name) {
    console.log(
      'Usage: npm run admin:create -- --email admin@example.edu --name "School Administrator"',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  if (!process.env.MONGO_URL)
    throw new Error(
      "Set MONGO_URL in server/.env before creating an administrator.",
    );
  const credentialsPath = values["credentials-file"]
    ? path.resolve(values["credentials-file"])
    : defaultCredentialsPath;
  let password;
  do {
    password = randomBytes(24).toString("base64url");
  } while (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  );
  const profile = validate(schemas.register, {
    name: values.name,
    email: values.email,
    password,
  });
  // Reserve a private file before changing the database; never overwrite credentials.
  const file = await open(credentialsPath, "wx", 0o600).catch((error) => {
    if (error.code === "EEXIST")
      throw new Error(
        "The private .local-admin-credentials.txt file already exists. Keep its credentials safe and move it out of the project before creating another administrator.",
      );
    throw error;
  });
  let database,
    created = false;
  try {
    database = await connectDatabase(
      process.env.MONGO_URL,
      process.env.MONGO_DB_NAME || "classroom_lms",
    );
    if (
      await database.db
        .collection("lms_users")
        .findOne({ email: profile.email })
    )
      throw new Error(
        "That email already has an account. Use a separate administrator email; existing accounts are not modified.",
      );
    await file.writeFile(
      `Knowhere to Grow — private administrator credentials\nEmail: ${profile.email}\nPassword: ${password}\n\nSign in through the web login page. Change the initial password in My profile. Do not share or commit this file.\n`,
    );
    const result = await database.db.collection("lms_users").insertOne({
      name: profile.name,
      email: profile.email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      status: "active",
      bio: "",
      department: "Administration",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    created = true;
    await database.db.collection("lms_admin_activity").insertOne({
      actorId: result.insertedId,
      actorName: profile.name,
      action: "admin.created",
      targetId: result.insertedId,
      targetName: profile.name,
      detail: "Administrator provisioned through the private server command.",
      createdAt: new Date(),
    });
    console.log(
      `Administrator created. Open this private file locally for the sign-in details:\n${credentialsPath}\nUse the ordinary web login page. Mobile access is disabled for administrators.`,
    );
  } finally {
    await file.close();
    if (!created) await unlink(credentialsPath).catch(() => {});
    await database?.client.close();
  }
}
main().catch((error) => {
  console.error(
    error.code === 11000
      ? "An account with this email already exists."
      : error.message,
  );
  process.exitCode = 1;
});

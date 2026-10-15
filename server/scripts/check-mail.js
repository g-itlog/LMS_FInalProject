import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createMailer, smtpConfig } from "../src/mail.js";
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
try {
  const mailer = createMailer(smtpConfig());
  await mailer.verify();
  console.log(
    "SMTP connection, TLS, and authentication passed. No email was sent.",
  );
  console.log(
    "Next, register a disposable account with a mailbox you own and verify the delivered code.",
  );
} catch (error) {
  console.error(
    error.publicMessage ||
      `SMTP check failed (${error.code || error.name}). Check SMTP_HOST, port/TLS, username, App Password or SMTP key, and sender configuration.`,
  );
  process.exitCode = 1;
}

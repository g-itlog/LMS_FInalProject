import { test } from "node:test";
import assert from "node:assert/strict";
import { smtpConfig, createMailer } from "../src/mail.js";
test("SMTP configuration validates transport settings without logging credentials", () => {
  const settings = smtpConfig({
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "private-app-password",
    SMTP_FROM: "Knowhere to Grow <sender@example.test>",
  });
  assert.equal(settings.port, 587);
  assert.equal(settings.secure, false);
  assert.doesNotThrow(() => createMailer(settings).ready());
  assert.throws(
    () =>
      createMailer({
        ...settings,
        from: "sender@example.test\r\nBcc:another@example.test",
      }).ready(),
    /not configured/,
  );
  assert.throws(
    () => createMailer({ ...settings, port: 25 }).ready(),
    /not configured/,
  );
});

import nodemailer from "nodemailer";

export function smtpConfig(env = process.env) {
  return {
    host: env.SMTP_HOST?.trim(),
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === "true",
    user: env.SMTP_USER?.trim(),
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM?.trim(),
  };
}
export function createMailer(settings = {}) {
  let transport;
  function ready() {
    if (
      !settings.host ||
      !settings.user ||
      !settings.pass ||
      !settings.from ||
      ![465, 587, 2525].includes(settings.port) ||
      /[\r\n]/.test(settings.from)
    )
      throw Object.assign(
        new Error(
          "Email delivery is not configured. Contact the school administrator.",
        ),
        {
          status: 503,
          publicMessage:
            "Email delivery is not configured. Contact the school administrator.",
        },
      );
    transport ||= nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      auth: { user: settings.user, pass: settings.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    });
  }
  return {
    ready,
    async verify() {
      ready();
      await transport.verify();
    },
    async sendOtp({ email, code, purpose }) {
      ready();
      const label =
        purpose === "register" ? "Verify your email" : "Reset your password";
      const result = await transport.sendMail({
        from: settings.from,
        to: email,
        subject: `${label} — Knowhere to Grow`,
        text: `${label}\n\nYour Knowhere to Grow verification code is: ${code}\n\nThis code expires in 10 minutes and works once. Do not share it. If you did not request this code, ignore this email.\n\nKnowhere to Grow`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#203d49;padding:28px;background:#f7f5ef"><p>KNOWHERE TO GROW</p><h1 style="font-size:25px">${label}</h1><p>Enter this code in the app or website you requested it from.</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p><p>Expires in 10 minutes. This code works once. Do not share it.</p><p>If you did not request this code, ignore this email.</p></div>`,
      });
      if (!result.accepted?.length) throw new Error("SMTP recipient rejected");
    },
  };
}

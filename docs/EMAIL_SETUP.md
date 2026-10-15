# Email OTP and password recovery

Public registration on web and student Flutter requires proof that the user can receive mail at the given address. OTP proves mailbox access, not a person's identity or school affiliation; instructors still need an unused invitation. Forgot password supports all web roles and students only in Flutter.

**Brevo SMTP connection, TLS, and authentication passed locally on 16 October 2026. Actual OTP inbox delivery still needs verification.** Private SMTP credentials are configured in server/.env and are excluded from Git. Vercel requires its own environment variables and redeployment. Login works without SMTP; new public registration/recovery fails clearly rather than bypassing verification.

## Brevo setup (current provider)

1. Add and verify a sender under Settings → Senders, domains, IPs.
2. Open Settings → SMTP & API → SMTP. Copy the SMTP login and generate a Standard SMTP key.
3. Set these private values locally and in Vercel, replacing placeholders:

```dotenv
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-login@smtp-brevo.com
SMTP_PASS=your-private-smtp-key
SMTP_FROM="Knowhere to Grow <your-verified-sender@example.com>"
```

The SMTP login may differ from your sender email. Use an SMTP key, not an API key or account password. An authenticated domain you own improves delivery; Brevo may replace free-mail sender addresses with a provider-managed address. [Brevo SMTP settings](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP).

## Gmail setup (alternative provider)

1. Use a sending Gmail account you own. Enable its **2-Step Verification**.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords), create one named Knowhere to Grow, and copy it privately. Account restrictions may make this option unavailable; another SMTP provider can be used instead.
3. Fill the private server/.env fields, replacing these example values:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-sending-account@gmail.com
SMTP_PASS=your16characterapppassword
SMTP_FROM="Knowhere to Grow <your-sending-account@gmail.com>"
```

Use the same sender in SMTP_USER and SMTP_FROM. Copy the App Password without Google's grouping spaces. This is separate from both your Gmail password and LMS password. Do not paste it in chat, commit it, or add it to any VITE_* or Flutter setting. Google requires 2-Step Verification for App Passwords and can revoke them after a Google password change. [Google guide](https://support.google.com/mail/answer/185833?hl=en)

Nodemailer uses SMTP; the provider supplies the mailbox and controls quotas, restrictions, and delivery. SMTP itself is not a free email service. Vercel allows outgoing SMTP except port 25. The app supports 587/2525 with required STARTTLS or 465 with SMTP_SECURE=true. [Vercel guidance](https://vercel.com/kb/guide/serverless-functions-and-smtp), [Nodemailer transport options](https://nodemailer.com/smtp)

For another provider, use its SMTP hostname, username/key/password, and verified sender. Certificate verification stays enabled.

## Check and deploy

From the repository root:

```powershell
npm run mail:check
```

This checks connection, TLS, and authentication without sending email or printing credentials. It does not prove recipient delivery or sender authorization. Restart the local server after .env edits.

Add the same **six SMTP variables** under Vercel → Project → Settings → Environment Variables, for Production and any Preview environment that needs email. Enter SMTP_FROM without the surrounding .env quotation marks. **Redeploy after saving.** Local .env values are ignored by Git and never populate Vercel automatically. Keep the existing database/auth/origin variables. Email sending is awaited inside the function before success is returned.

Use disposable accounts and a real mailbox you own:

- [ ] Register on the deployed website. No account/session should exist before code verification.
- [ ] Receive Verify your email — Knowhere to Grow, including checking spam. Enter the actual code and finish registration.
- [ ] Sign out, select Forgot password?, and receive Reset your password — Knowhere to Grow.
- [ ] Verify the code, enter a strong new password twice, and save. Confirm the old password fails, the new one works, and other web/mobile sessions are revoked.
- [ ] Repeat in Flutter using the deployed HTTPS /api base. Instructors/admins stay web-only.
- [ ] Try an incorrect/expired code and immediate resend. Expect an error/cooldown without account/password changes.

EAUTH indicates credentials/account authentication issues; ETIMEDOUT/ESOCKET can indicate host/port/network/TLS issues. If authentication passes but mail is absent, inspect sender authorization, provider logs/quotas, and spam. SMTP acceptance can still be followed by a bounce. Keep credentials/OTPs out of diagnostic screenshots and logs.

## Security and behavior

- Six cryptographically generated digits, valid for 10 minutes, with five guesses maximum. Codes are stored as keyed HMACs, never plaintext. A code can issue only one short-lived proof.
- Per email/purpose: one resend per 60 seconds and five requests per 15-minute window. MongoDB stores limits and guesses across Vercel cold starts. Resends invalidate prior unverified codes. API/auth IP limits also apply.
- Proofs expire 10 minutes after verification and are bound to email and purpose. Registration consumes its proof, creates the account, and consumes any invitation in one transaction. Failed registration rolls back consumption; correct the form while its proof remains valid.
- Reset verification alone does not change the password or revoke sessions. Final completion validates the new password, updates its bcrypt hash, revokes all sessions, invalidates other reset challenges, and requires fresh login. Old/concurrent grants cannot overwrite a newer password.
- Reset requests return the same status/message for eligible, unknown, suspended, and mobile-ineligible accounts. Only eligible accounts receive email. Requesting a reset does not lock an account. SMTP/network timing is not guaranteed identical between paths.
- Passwords retain uppercase/lowercase/number requirements and the 8–72-character/72-byte limit. Both clients check reset confirmation and the server validates the new password.
- Existing and trusted admin-provisioned accounts remain usable; their historical mailbox ownership is not assumed verified. New public accounts receive emailVerifiedAt. Admin email edits clear this marker. Recovery records verification of the current email.
- Production APIs never return/log OTPs, SMTP credentials, or reset proofs in audit logs. The fake mailbox exists only in the isolated loopback browser test server. TTL indexes clean temporary records; validity checks do not depend on cleanup timing.

See [OWASP password-recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Automated checks use isolated MongoDB and fake email delivery. Live SMTP/inbox delivery and native device testing remain separate acceptance checks.

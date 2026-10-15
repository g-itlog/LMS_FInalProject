import { expect } from "@playwright/test";
// Only the isolated loopback test server exposes this fake mailbox.
export async function verifyMailbox(page, email) {
  await expect(page.getByLabel("Email verification code")).toBeVisible();
  const mail = await (
    await page.request.get(`/__test/mail?email=${encodeURIComponent(email)}`)
  ).json();
  expect(mail.code).toMatch(/^\d{6}$/);
  await page.getByLabel("Email verification code").fill(mail.code);
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
}
export async function submitRegistration(page, status = 201) {
  const back = page.getByRole("button", {
    name: "Back to registration",
    exact: true,
  });
  if (await back.isVisible()) await back.click();
  const email = await page
    .getByLabel("Email address", { exact: true })
    .inputValue();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/register") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const first = await Promise.race([
    response.then(() => "registered"),
    page
      .getByLabel("Email verification code")
      .waitFor({ state: "visible" })
      .then(() => "otp"),
  ]);
  if (first === "otp") await verifyMailbox(page, email.toLowerCase());
  expect((await response).status()).toBe(status);
  if (status === 201) await expectRegistrationLogin(page, email.toLowerCase());
}

export async function expectRegistrationLogin(page, email) {
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText(
    "Registration successful",
  );
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    email,
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
}

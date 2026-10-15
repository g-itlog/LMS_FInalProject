import { test, expect } from "@playwright/test";
import {
  expectRegistrationLogin,
  submitRegistration,
  verifyMailbox,
} from "./helpers/email";

test("registration waits for email proof, validates codes, and never creates an account on an incorrect code", async ({
  page,
}) => {
  const email = "otp-registration@example.edu";
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Verified Browser Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Verified2026!");
  let registrations = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/auth/register")) registrations++;
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Verify your email" });
  await expect(dialog).toBeVisible();
  expect(registrations).toBe(0);
  await expect(
    dialog.getByRole("button", { name: /Resend in/ }),
  ).toBeDisabled();
  await page.getByLabel("Email verification code").fill("12");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("six-digit");
  expect(registrations).toBe(0);
  const mail = await (
    await page.request.get(`/__test/mail?email=${email}`)
  ).json();
  await page
    .getByLabel("Email verification code")
    .fill(mail.code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("invalid, expired");
  expect(registrations).toBe(0);
  await page.getByLabel("Email verification code").fill("");
  await page.screenshot({
    path: "../docs/screenshots/web-email-verification-phone.png",
    fullPage: true,
  });
  await verifyMailbox(page, email);
  await expectRegistrationLogin(page, email);
  expect(registrations).toBe(1);
  await page.getByLabel("Password", { exact: true }).fill("Incorrect2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Password", { exact: true }).fill("Verified2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  expect(
    (await (await page.request.get("/api/auth/me")).json()).user
      .emailVerifiedAt,
  ).toBeTruthy();
});
test("forgot password verifies an emailed code before new-password entry, validates confirmation, then requires fresh login", async ({
  page,
}) => {
  const email = "password-reset-browser@example.edu";
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Recovery Browser Student");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Original2026!");
  await submitRegistration(page);
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Forgot your password?" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByLabel("Email address").fill("broken");
  await expect(page.getByText(/Enter a valid email/)).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset code" }).click();
  await verifyMailbox(page, email);
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("weak");
  await expect(page.locator("#newPassword-error")).toContainText("8");
  await page.getByLabel("New password", { exact: true }).fill("Updated2026!");
  await page.getByLabel("Confirm new password").fill("Mismatch2026!");
  await expect(page.locator("#confirmPassword-error")).toContainText("match");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
  await page.getByLabel("Confirm new password").fill("Updated2026!");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re ready to return." }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/web-password-reset-phone.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Back to sign in", exact: true })
    .click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Original2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await page.getByLabel("Password", { exact: true }).fill("Updated2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
});

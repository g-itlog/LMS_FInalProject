import { test, expect } from "@playwright/test";
import { submitRegistration } from "./helpers/email";

test("login validates inline, blocks invalid requests, and retains server authentication", async ({
  page,
}) => {
  let attempts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/auth/login")
    )
      attempts++;
  });
  await page.goto("/login");
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password", { exact: true });
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await email.fill("student@");
  await expect(page.locator("#email-error")).toContainText("valid email");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(email).toBeFocused();
  await expect(page.locator("#password-error")).toContainText(
    "Enter your password",
  );
  expect(attempts).toBe(0);
  await email.fill("student@classroom.test");
  await expect(page.locator("#email-error")).toBeEmpty();
  await password.fill("x");
  await expect(page.locator("#password-error")).toBeEmpty();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Email or password is incorrect",
  );
  expect(attempts).toBe(1);
  await password.fill("Classroom2026!");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  expect(attempts).toBe(2);
});

test("student registration validates names and password rules live on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  let attempts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/auth/register")
    )
      attempts++;
  });
  await page.goto("/register");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await page.getByLabel("Full name").fill(" ");
  await expect(page.locator("#name-error")).toContainText("full name");
  await page.getByLabel("Full name").fill("Ana Cruz");
  await expect(page.locator("#name-error")).toBeEmpty();
  await page.getByLabel("Email address").fill("validation-student@example.edu");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("learning");
  await expect(page.locator("#password-error")).toContainText("uppercase");
  await expect(page.locator("#password-requirements .met")).toHaveCount(2);
  await password.fill("Aa1" + "é".repeat(35));
  await expect(page.locator("#password-error")).toContainText("72 bytes");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(password).toBeFocused();
  expect(attempts).toBe(0);
  await password.fill("Learning42");
  await expect(page.locator("#password-error")).toBeEmpty();
  await expect(page.locator("#password-requirements .met")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await submitRegistration(page);
  await page.getByLabel("Password", { exact: true }).fill("Learning42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  expect(attempts).toBe(1);
});

test("instructor code validation follows the selected role and auth pages reset", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Instructor Test");
  await page
    .getByLabel("Email address")
    .fill("validation-instructor@example.edu");
  await page.getByLabel("Password", { exact: true }).fill("Learning42");
  await page.getByRole("button", { name: /instructor/ }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Instructor invitation code")).toBeFocused();
  await expect(page.locator("#inviteCode-error")).toContainText(
    "invitation code",
  );
  await page.getByLabel("Instructor invitation code").fill("wrong-code");
  await expect(page.locator("#inviteCode-error")).toBeEmpty();
  await submitRegistration(page, 403);
  await expect(page.getByRole("alert")).toContainText(
    "valid instructor invitation code",
  );
  await page
    .getByRole("button", { name: "Back to registration", exact: true })
    .click();
  await page.getByRole("button", { name: /student/ }).click();
  await expect(page.getByLabel("Instructor invitation code")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Email address")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByLabel("Instructor invitation code")).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import { submitRegistration } from "./helpers/email";

async function login(page, email = "admin@classroom.test") {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Classroom2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: email.startsWith("admin") ? "School overview" : /Hello,/,
    }),
  ).toBeVisible();
}
test("administrator overview and every admin page fit desktop, tablet, and phone", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await expect(page.getByText("Admin workspace")).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/admin/users",
      "/admin/courses",
      "/admin/invitations",
      "/admin/reports",
      "/admin/activity",
      "/profile",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
      if (width === 320 && ["/admin/users", "/admin/courses"].includes(route)) {
        await page
          .getByRole("button", {
            name: route.endsWith("users")
              ? /^View account for/
              : /^View course/,
          })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator(".admin-counts")).toBeVisible();
        expect(
          await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        ).toBe(true);
        await dialog.getByRole("button", { name: "Close dialog" }).click();
      }
      if ([1440, 390].includes(width) && route === "/")
        await page.screenshot({
          path: path.resolve(
            `../docs/screenshots/web-admin-${width === 1440 ? "dashboard" : "phone"}.png`,
          ),
          fullPage: true,
          animations: "disabled",
        });
      if (width === 1440 && route === "/admin/users")
        await page.screenshot({
          path: path.resolve("../docs/screenshots/web-admin-users.png"),
          fullPage: true,
          animations: "disabled",
        });
      if (width === 1440 && route === "/admin/courses")
        await page.screenshot({
          path: path.resolve("../docs/screenshots/web-admin-courses.png"),
          fullPage: true,
          animations: "disabled",
        });
      if (width === 1440 && route === "/admin/invitations")
        await page.screenshot({
          path: path.resolve("../docs/screenshots/web-admin-invitations.png"),
          fullPage: true,
          animations: "disabled",
        });
      if ([1440, 390].includes(width) && route === "/admin/reports") {
        await expect(page.locator(".analytics-course-table")).toBeVisible();
        await page.screenshot({
          path: path.resolve(
            `../docs/screenshots/web-admin-reports-${width === 1440 ? "desktop" : "phone"}.png`,
          ),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
  await page.goto("/courses");
  await expect(
    page.getByRole("heading", { name: "School overview" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("admin can create, search, edit, suspend, and reactivate accounts with audited actions", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "Create an account" });
  await create.getByLabel("Full name").fill("Browser Test Student");
  await create
    .getByLabel("Email address")
    .fill("browser-admin-user@example.edu");
  await create.getByLabel("Department").fill("Computer Studies");
  await create.getByLabel("Initial password").fill("Password2026!");
  await create
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(create).toHaveCount(0);
  await page.getByRole("searchbox").fill("browser-admin-user@example.edu");
  await expect(
    page.getByRole("heading", { name: "Browser Test Student" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View account for Browser Test Student" })
    .click();
  const account = page.getByRole("dialog", { name: "Account details" });
  await account.getByLabel("Full name").fill("Updated Browser User");
  await account.getByLabel("Account role").selectOption("instructor");
  await account.getByRole("button", { name: "Save changes" }).click();
  await expect(account).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Updated Browser User" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View account for Updated Browser User" })
    .click();
  await account
    .getByRole("button", { name: "Suspend account", exact: true })
    .click();
  const suspend = page.getByRole("dialog", { name: "Suspend this account?" });
  await suspend
    .getByRole("button", { name: "Suspend account", exact: true })
    .click();
  await expect(account).toHaveCount(0);
  await expect(
    page.locator(".admin-user-row").getByText("Suspended", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View account for Updated Browser User" })
    .click();
  await account
    .getByRole("button", { name: "Reactivate account", exact: true })
    .click();
  const reactivate = page.getByRole("dialog", {
    name: "Reactivate this account?",
  });
  await reactivate
    .getByRole("button", { name: "Reactivate account", exact: true })
    .click();
  await expect(account).toHaveCount(0);
  await expect(
    page.locator(".admin-user-row").getByText("Active", { exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("Morgan Reyes");
  await page
    .getByRole("button", { name: "View account for Morgan Reyes" })
    .click();
  await expect(
    account.getByText(/Administrator accounts are protected/),
  ).toBeVisible();
  await expect(
    account.getByRole("button", { name: "Suspend account", exact: true }),
  ).toHaveCount(0);
  await account.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/admin/activity");
  await page.getByRole("searchbox").fill("Browser");
  await expect(
    page.getByText("Account created", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/status: active → suspended/)).toBeVisible();
  await expect(page.getByText(/status: suspended → active/)).toBeVisible();
});

test("admin can inspect courses and control publication without taking over teaching", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/courses");
  await page.getByRole("searchbox").fill("IT 301");
  await expect(
    page.getByRole("button", { name: "View course IT 301", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View course IT 301", exact: true })
    .click();
  const details = page.getByRole("dialog", { name: "Course overview" });
  await expect(
    details.getByText("Full-Stack Web Development", { exact: true }),
  ).toBeVisible();
  await expect(
    details.getByRole("heading", { name: /Recent submissions/ }),
  ).toBeVisible();
  await details.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Unpublish IT 301", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Unpublish IT 301?" })
    .getByRole("button", { name: "Unpublish course" })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish IT 301", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Publish IT 301", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Publish IT 301?" })
    .getByRole("button", { name: "Publish course" })
    .click();
  await expect(
    page.getByRole("button", { name: "Unpublish IT 301", exact: true }),
  ).toBeVisible();
});

test("student routes cannot enter the administration workspace", async ({
  page,
}) => {
  await login(page, "student@classroom.test");
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Reports & analytics", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
});

test("admin reports support period filters, exact chart values, empty periods, course search, and CSV downloads", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator(".analytics-line-chart")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Your learning community:/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Reports & analytics", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Reports & analytics", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".analytics-course-table")).toBeVisible();
  await page.getByLabel("Reporting period", { exact: true }).selectOption("7");
  await expect(page.locator(".analytics-course-table")).toBeVisible();
  await page.getByText("View daily data", { exact: true }).click();
  await expect(page.locator(".analytics-data-details tbody tr")).toHaveCount(7);
  const slider = page.getByRole("slider", { name: "Inspect activity date" });
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await slider.press("End");
  await expect(slider).toHaveValue("6");
  const query = new URLSearchParams({
    from: await page.getByLabel("From", { exact: true }).inputValue(),
    to: await page.getByLabel("Through", { exact: true }).inputValue(),
  });
  const response = await page.request.get(`/api/admin/reports?${query}`);
  const report = await response.json();
  await expect(
    page
      .locator(".analytics-stats .stat-card")
      .filter({ hasText: "Latest submissions" })
      .locator("strong"),
  ).toHaveText(String(report.summary.submissions));
  await page
    .getByRole("searchbox", { name: "Search report courses" })
    .fill("IT 301");
  await expect(page.locator(".analytics-course-table tbody tr")).toHaveCount(1);
  await expect(
    page.getByRole("searchbox", { name: "Search report courses" }),
  ).toBeFocused();
  await expect(page.locator(".analytics-course-table tbody")).toContainText(
    "IT 301",
  );
  const courseDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Course CSV", exact: true }).click();
  const courseFile = await courseDownload;
  expect(courseFile.suggestedFilename()).toContain("knowhere-courses-");
  const courseCsv = await fs.readFile(await courseFile.path(), "utf8");
  expect(courseCsv).toContain('"IT 301"');
  expect(courseCsv).toContain('"Weighted score percent"');
  expect(courseCsv).not.toContain('"CS 201"');
  const dailyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Daily CSV", exact: true }).click();
  const dailyFile = await dailyDownload;
  const dailyCsv = await fs.readFile(await dailyFile.path(), "utf8");
  expect(dailyCsv.split("\r\n").filter(Boolean)).toHaveLength(8);
  await page.getByLabel("From", { exact: true }).fill("2001-01-01");
  await page.getByLabel("Through", { exact: true }).fill("2001-01-02");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(
    page.getByText("No activity recorded for this period.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".analytics-stats .stat-card")
      .filter({ hasText: "Latest submissions" })
      .locator("strong"),
  ).toHaveText("0");
  await expect(page.locator(".analytics-summary-metrics")).not.toContainText(
    "NaN",
  );
  await page.getByLabel("From", { exact: true }).fill("2001-01-03");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("1–366 days");
});

test("admin reports show a recoverable API error and retry correctly", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/admin/reports?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Report temporarily unavailable." }),
    }),
  );
  await page.goto("/admin/reports");
  await expect(page.getByRole("alert")).toContainText(
    "Report temporarily unavailable.",
  );
  await page.unroute("**/api/admin/reports?*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".analytics-course-table")).toBeVisible();
  await page.route("**/api/admin/reports/export?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "CSV export temporarily unavailable. Try again.",
      }),
    }),
  );
  const exportButton = page.getByRole("button", {
    name: "Course CSV",
    exact: true,
  });
  await exportButton.click();
  await expect(
    page.getByText("CSV export temporarily unavailable. Try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(exportButton).toBeEnabled();
  await page.unroute("**/api/admin/reports/export?*");
  const retryDownload = page.waitForEvent("download");
  await exportButton.click();
  expect((await retryDownload).suggestedFilename()).toContain(
    "knowhere-courses-",
  );
});

test("admin manages single-use invitations and successful signup permanently consumes the code", async ({
  page,
  browser,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page.goto("/admin/invitations");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const create = page.getByRole("dialog", {
    name: "Create invitation",
    exact: true,
  });
  await create
    .getByLabel("Invitation label")
    .fill("Browser faculty invitation");
  await create
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await expect(create).toHaveCount(0);
  const card = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Browser faculty invitation",
      exact: true,
    }),
  });
  const code = await card.locator("code").innerText();
  expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/);
  await card
    .getByRole("button", {
      name: "Copy invitation code for Browser faculty invitation",
    })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await card
    .getByRole("button", {
      name: "Deactivate invitation Browser faculty invitation",
    })
    .click();
  await page
    .getByRole("dialog", { name: "Deactivate this invitation?" })
    .getByRole("button", { name: "Deactivate invitation", exact: true })
    .click();
  await expect(card.getByText("Inactive", { exact: true })).toBeVisible();

  const teacherContext = await browser.newContext();
  const guestContext = await browser.newContext();
  async function registrationForm(target, email) {
    await target.goto("http://127.0.0.1:8001/register");
    await target.getByRole("button", { name: /instructor/ }).click();
    await target.getByLabel("Full name").fill("Invited Browser Instructor");
    await target.getByLabel("Email address").fill(email);
    await target.getByLabel("Password", { exact: true }).fill("Password2026!");
  }
  async function submit(target, expectedStatus) {
    await submitRegistration(target, expectedStatus);
  }
  try {
    const teacher = await teacherContext.newPage();
    await registrationForm(teacher, "browser-invited@example.edu");
    await teacher.getByLabel("Instructor invitation code").fill(code);
    await submit(teacher, 403);
    await expect(teacher.getByRole("alert")).toContainText(
      "valid instructor invitation code",
    );

    await card
      .getByRole("button", {
        name: "Edit invitation Browser faculty invitation",
      })
      .click();
    const edit = page.getByRole("dialog", {
      name: "Edit invitation",
      exact: true,
    });
    await edit
      .getByLabel("Replacement code (optional)")
      .fill("BrowserFacultyReplacement2026");
    await edit.getByRole("button", { name: "Save invitation" }).click();
    await expect(edit).toHaveCount(0);
    await expect(card.getByText("Inactive", { exact: true })).toBeVisible();
    await card
      .getByRole("button", {
        name: "Reactivate invitation Browser faculty invitation",
      })
      .click();
    await page
      .getByRole("dialog", { name: "Reactivate this invitation?" })
      .getByRole("button", { name: "Reactivate invitation", exact: true })
      .click();
    await expect(card.getByText("Active", { exact: true })).toBeVisible();
    await submit(teacher, 403);
    await teacher
      .getByLabel("Instructor invitation code")
      .fill("BrowserFacultyReplacement2026");
    await submit(teacher, 201);
    await teacher.getByLabel("Password", { exact: true }).fill("Wrong2026!");
    await teacher.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(teacher.getByRole("alert")).toContainText("incorrect");
    await teacher.getByLabel("Password", { exact: true }).fill("Password2026!");
    await teacher.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      teacher.getByRole("heading", { name: /Hello,/ }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Invitation codes", exact: true }),
    ).toBeVisible();
    await expect(card).toHaveCount(0);
    await page.getByLabel("Filter invitation status").selectOption("used");
    await expect(card.getByText("Used", { exact: true })).toBeVisible();
    await expect(
      card.getByText(/cannot be reused or reactivated/),
    ).toBeVisible();
    await expect(card.locator("code")).toHaveCount(0);
    await expect(card.getByRole("button")).toHaveCount(0);

    const guest = await guestContext.newPage();
    await registrationForm(guest, "browser-invited-second@example.edu");
    await guest
      .getByLabel("Instructor invitation code")
      .fill("BrowserFacultyReplacement2026");
    await submit(guest, 403);
    await expect(guest.getByRole("alert")).toContainText(
      "valid instructor invitation code",
    );
    await teacher.reload();
    await expect(
      teacher.getByRole("heading", { name: /Hello,/ }),
    ).toBeVisible();
  } finally {
    await teacherContext.close();
    await guestContext.close();
  }
});

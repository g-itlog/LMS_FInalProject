import { test, expect } from "@playwright/test";
import path from "node:path";
const screenshots = path.resolve("../docs/screenshots");
async function login(page, email) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Classroom2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
}

test("expanded course catalog supports pagination, search, enrollment, and worksheet downloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1040 });
  await login(page, "student@classroom.test");
  await page.goto("/courses?scope=catalog");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/web-course-catalog.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("searchbox").fill("Python");
  await expect(
    page.getByRole("heading", { name: "Programming Foundations with Python" }),
  ).toBeVisible();
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", {
        name: "Programming Foundations with Python",
      }),
    })
    .click();
  await page.getByRole("button", { name: "Join course", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your learning resources" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Python language tutorial" }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "IT-101-practice.txt" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("IT-101-practice.txt");
  expect(await download.failure()).toBeNull();
  await page.getByRole("tab", { name: /Assignments/ }).click();
  await page.getByRole("button", { name: "Open assignment" }).click();
  await page
    .getByLabel("Your response")
    .fill(
      "My Python calculator validates the scores and tests the boundary cases.",
    );
  await page
    .getByRole("button", { name: "Submit assignment", exact: true })
    .click();
  await expect(page.getByText("Your work has been submitted.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses?scope=catalog");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("student desktop and phone workflows render without browser errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto("/login");
  await page.screenshot({
    path: `${screenshots}/web-login.png`,
    fullPage: true,
    animations: "disabled",
  });
  await login(page, "student@classroom.test");
  await page.screenshot({
    path: `${screenshots}/web-student-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "My courses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My courses" })).toBeVisible();
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "Full-Stack Web Development" }),
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your learning resources" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/web-course-materials.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: /Assignments/ }).click();
  await page.getByRole("button", { name: "Open assignment" }).first().click();
  await page
    .getByLabel("Your response")
    .fill("This is an end-to-end tested student submission.");
  await page
    .getByRole("button", { name: "Submit assignment", exact: true })
    .click();
  await expect(page.getByText("Your work has been submitted.")).toBeVisible();
  await page
    .getByRole("link", { name: "Grades & feedback", exact: true })
    .click();
  await expect(page.getByText("92 / 100")).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/web-student-grades.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/web-phone-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "My courses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My courses" })).toBeVisible();
  await page.screenshot({
    path: `${screenshots}/web-phone-courses.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await page
    .getByLabel("About me")
    .fill("Updated during the browser workflow test.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile updated.")).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("instructor reviews student work and performs course content CRUD", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1040 });
  await login(page, "instructor@classroom.test");
  await page.screenshot({
    path: `${screenshots}/web-instructor-dashboard.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: "Review submissions", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "Build your first REST API" });
  await row.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Grade (out of 100)").fill("95");
  await page
    .getByLabel("Written feedback")
    .fill("Clear implementation and good testing evidence.");
  await page.screenshot({
    path: `${screenshots}/web-instructor-review.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Save grade & feedback", exact: true })
    .click();
  await expect(page.getByText("Grade and feedback saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/courses?create=1");
  await page.getByLabel("Course title").fill("Browser Test Classroom");
  await page.getByLabel("Course code").fill("QA 101");
  await page.getByLabel("Category", { exact: true }).fill("Quality Assurance");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A classroom for testing complete create and update workflows.");
  await page.getByLabel("Publish course").check();
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .last()
    .click();
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "Browser Test Classroom" }),
    })
    .click();
  await page.getByRole("button", { name: "Add material" }).click();
  await page.getByLabel("Title", { exact: true }).fill("API study notes");
  await page.getByLabel("Resource link").fill("https://react.dev/learn");
  await page.getByRole("button", { name: "Create learning material" }).click();
  await expect(
    page.getByRole("heading", { name: "API study notes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit API study notes" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Updated API study notes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Updated API study notes" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Updated API study notes" })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little knowledge is on its way" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page
    .getByRole("button", { name: "Delete course", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My courses", exact: true }),
  ).toBeVisible();
});

for (const role of ["student", "instructor"]) {
  test(
    role +
      " workspace fits phone, tablet, and desktop with accessible navigation",
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, role + "@classroom.test");
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () =>
            document.fonts.check('16px "Lora"') &&
            document.fonts.check('16px "Public Sans"'),
        ),
      ).toBe(true);
      const menu = page.getByRole("button", { name: "Open navigation" });
      await expect(page.locator("#workspace-navigation")).toHaveAttribute(
        "inert",
        "",
      );
      await menu.click();
      await expect(
        page.locator("aside").getByRole("button", { name: "Close navigation" }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      const data = await page.evaluate(async () =>
        (await fetch("/api/dashboard")).json(),
      );
      const due = data.assignments
        .filter(
          (a) =>
            !data.submissions.some((s) => s.assignmentId === a._id) &&
            new Date(a.dueDate) >= new Date(),
        )
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      if (role === "student" && due.length) {
        await expect(page.locator(".welcome-banner h2")).toHaveText(
          due[0].title,
        );
        await page.locator(".welcome-banner a").click();
        await expect(
          page.getByRole("tab", { name: /Assignments/ }),
        ).toHaveAttribute("aria-selected", "true");
      }
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of [
          "/",
          "/courses",
          "/assignments",
          "/grades",
          "/announcements",
          "/profile",
        ]) {
          await page.goto(route);
          await expect(page.locator("main h1")).toBeVisible();
          if (width === 390 && route === "/assignments")
            await page.screenshot({
              path: `${screenshots}/web-phone-assignments-${role}.png`,
              fullPage: true,
              animations: "disabled",
            });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            role + " " + route + " at " + width + "px",
          ).toBe(true);
        }
      }
    },
  );
}

import { test, expect } from "@playwright/test";
async function login(page, email) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Classroom2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
}
test("instructor creates quiz, student takes and reviews it, instructor tracks results and progress", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "instructor@classroom.test");
  const courses = await (
    await page.request.get("/api/courses?search=Full-Stack")
  ).json();
  const course = courses.items.find(
    (c) => c.title === "Full-Stack Web Development",
  );
  await page.goto(`/courses/${course._id}?tab=quizzes`);
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await page
    .getByLabel("Quiz title", { exact: true })
    .fill("Browser workflow quiz");
  await page.getByLabel("Quiz instructions").fill("Choose the correct answer.");
  await page
    .getByLabel("Question 1 prompt")
    .fill("Which language runs in a browser?");
  await page.getByLabel("Question 1, option 1").fill("JavaScript");
  await page.getByLabel("Question 1, option 2").fill("A spreadsheet");
  await page.getByLabel("Question 1 points").fill("5");
  await page
    .getByLabel("Question 1 explanation (optional)")
    .fill("JavaScript powers browser interactions.");
  await page.getByLabel("Publish quiz", { exact: true }).check();
  await page.getByRole("button", { name: "Save quiz", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser workflow quiz" }),
  ).toBeVisible();
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await login(student, "student@classroom.test");
  await student.setViewportSize({ width: 320, height: 1000 });
  await student.goto(`/courses/${course._id}?tab=quizzes`);
  await student.getByRole("button", { name: "Open quiz" }).click();
  await student.getByRole("button", { name: "Start attempt 1" }).click();
  await student.getByRole("radio", { name: "JavaScript", exact: true }).check();
  await student
    .getByRole("button", { name: "Submit answers", exact: true })
    .click();
  await student
    .getByRole("button", { name: "Confirm submission", exact: true })
    .click();
  await expect(
    student.getByRole("heading", { name: "Attempt 1: 5 / 5" }),
  ).toBeVisible();
  await student.getByText("Review answers", { exact: true }).click();
  await expect(
    student.getByText("Correct answer: JavaScript", { exact: false }),
  ).toBeVisible();
  expect(
    await student
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await student.screenshot({
    path: "../docs/screenshots/web-student-quiz-phone.png",
    fullPage: true,
  });
  await student.getByRole("button", { name: "Close dialog" }).click();
  await student.getByRole("tab", { name: "Progress", exact: true }).click();
  const mark = student
    .getByRole("button", { name: "Mark complete", exact: true })
    .first();
  await expect(mark).toBeVisible();
  await mark.click();
  await expect(
    student.getByRole("button", { name: "Mark incomplete" }).first(),
  ).toBeVisible();
  expect(
    await student.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await student.screenshot({
    path: "../docs/screenshots/web-student-progress-phone.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "View attempts" }).first().click();
  await expect(page.getByText(/Attempt 1: 5 \/ 5/)).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Best quiz scores" }),
  ).toBeVisible();
  await expect(page.getByText("Browser workflow quiz: 5/5")).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/web-instructor-progress.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await studentContext.close();
});
test("admin school announcements reach correct inboxes; enrollment and course management work", async ({
  page,
  browser,
}) => {
  await login(page, "admin@classroom.test");
  await page.goto("/admin/announcements");
  await page
    .getByRole("button", { name: "Post announcement", exact: true })
    .click();
  await page.getByLabel("Announcement title").fill("Browser school bulletin");
  await page
    .getByLabel("Message", { exact: true })
    .fill("A school update for student inboxes.");
  await page.getByLabel("Audience", { exact: true }).selectOption("student");
  await page.getByRole("button", { name: "Save announcement" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser school bulletin" }),
  ).toBeVisible();
  const ctx = await browser.newContext();
  const student = await ctx.newPage();
  await login(student, "student@classroom.test");
  await student.goto("/notifications");
  const notice = student
    .locator("article")
    .filter({
      has: student.getByRole("heading", { name: "Browser school bulletin" }),
    });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Mark as read" }).click();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await student.reload();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await page.goto("/admin/enrollments");
  await page.getByRole("searchbox").fill("Full-Stack");
  await expect(
    page.getByRole("cell", { name: /Full-Stack Web Development/ }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/web-admin-enrollments.png",
    fullPage: true,
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/admin/enrollments", "/admin/announcements"]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} ${width}`,
      ).toBe(true);
    }
  }
  await page.goto("/admin/courses");
  const card = page
    .locator(".admin-course-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Full-Stack Web Development",
        exact: true,
      }),
    });
  await card.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Category", { exact: true }).fill("Web Engineering");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card.getByText(/Web Engineering/)).toBeVisible();
  await page.goto("/admin/announcements");
  const post = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Browser school bulletin" }),
    });
  await post.getByRole("button", { name: "Delete announcement" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser school bulletin" }),
  ).toHaveCount(0);
  await ctx.close();
});

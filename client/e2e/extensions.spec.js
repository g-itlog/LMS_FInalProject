import { test, expect } from "@playwright/test";
const origin = "http://127.0.0.1:8001";
const date = (days) => new Date(Date.now() + days * 86400000).toISOString();
const local = (value) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
async function login(page, email = "instructor@classroom.test") {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Classroom2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main h1")).toBeVisible();
}
async function create(page, code) {
  const course = await page.request.post("/api/courses", {
    headers: { Origin: origin },
    data: {
      title: `Extension browser ${code}`,
      code,
      category: "Computing",
      description:
        "A disposable course for browser extension acceptance testing.",
      published: true,
      color: "blue",
    },
  });
  expect(course.status()).toBe(201);
  const c = await course.json();
  const assignment = await page.request.post(
    `/api/courses/${c._id}/assignments`,
    {
      headers: { Origin: origin },
      data: {
        title: "Browser deadline assignment",
        instructions:
          "Complete a response and submit it within your approved deadline.",
        dueDate: date(-1),
        maxPoints: 100,
        allowLate: false,
      },
    },
  );
  expect(assignment.status()).toBe(201);
  return { course: c, assignment: await assignment.json() };
}
async function openRequest(student, c) {
  await student.goto(`/courses/${c._id}?tab=assignments`);
  await student
    .getByRole("button", { name: "Request Deadline Extension", exact: true })
    .click();
  await expect(student.getByRole("dialog")).toBeVisible();
}
async function send(student, reason, days = 3) {
  await student.getByLabel("Reason for extension").fill(reason);
  await student
    .getByLabel("Requested deadline (your local time)")
    .fill(local(date(days)));
  await student.getByRole("button", { name: "Send extension request" }).click();
  await expect(
    student
      .getByRole("dialog")
      .locator("article")
      .filter({ hasText: reason })
      .locator(".status-badge"),
  ).toHaveText("Pending");
}
async function inboxReview(teacher, reason) {
  await teacher.goto("/notifications");
  const notice = teacher.locator("article").filter({ hasText: reason });
  await expect(notice).toBeVisible();
  await notice.getByRole("link", { name: "View extension request" }).click();
  await expect(
    teacher.getByRole("dialog", { name: "Review deadline extensions" }),
  ).toBeVisible();
  return teacher
    .getByRole("dialog")
    .locator("article")
    .filter({ hasText: reason });
}

test("student requests, instructor rejects with feedback, then approves an individual deadline and submission opens on phone", async ({
  page,
  browser,
}) => {
  await login(page);
  const { course, assignment } = await create(page, "EXT WEB 1");
  const ctx = await browser.newContext({
      viewport: { width: 320, height: 1000 },
    }),
    student = await ctx.newPage();
  try {
    await login(student, "student@classroom.test");
    await student.request.post(`/api/courses/${course._id}/enroll`, {
      headers: { Origin: origin },
    });
    await openRequest(student, course);
    await student.getByLabel("Reason for extension").fill("hi");
    await expect(
      student.getByText("Enter a reason with at least 10 characters."),
    ).toBeVisible();
    const reason =
      "I need more time to finish my source research and proofread my response.";
    await send(student, reason);
    expect(
      await student
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await student.screenshot({
      path: "../docs/screenshots/web-extension-request-phone.png",
      fullPage: true,
    });
    let row = await inboxReview(page, reason);
    await expect(
      row.getByText("Original class deadline at request"),
    ).toBeVisible();
    await row
      .getByLabel("Instructor comment (optional)")
      .fill("Please explain which sources are still missing.");
    await row.getByRole("button", { name: "Reject", exact: true }).click();
    await row.getByRole("button", { name: "Confirm rejection" }).click();
    await expect(row.locator(".status-badge")).toHaveText("Rejected");
    await student.reload();
    await expect(
      student.getByText("Please explain which sources are still missing."),
    ).toBeVisible();
    expect(
      (
        await (
          await student.request.get(
            `/api/assignments/${assignment._id}/extensions`,
          )
        ).json()
      ).assignment.dueDate,
    ).toBe(assignment.dueDate);
    const updatedReason =
      "I have identified the remaining sources and need time to verify the references.";
    await send(student, updatedReason, 4);
    row = await inboxReview(page, updatedReason);
    await expect(row.getByLabel("Approval applies to")).toHaveValue("student");
    await row
      .getByLabel("Instructor comment (optional)")
      .fill("Approved for your research work.");
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await row.getByRole("button", { name: "Confirm approval" }).click();
    await expect(row.locator(".status-badge")).toHaveText("Approved");
    await page.screenshot({
      path: "../docs/screenshots/web-extension-review.png",
      fullPage: true,
    });
    await student.reload();
    await expect(
      student.getByText("Approved for your research work."),
    ).toBeVisible();
    await student.getByRole("button", { name: "Close dialog" }).click();
    await expect(
      student.getByText(/Individual extension active/),
    ).toBeVisible();
    await student
      .getByRole("button", { name: "Open assignment", exact: true })
      .click();
    await student
      .getByLabel("Your response")
      .fill("My completed response under the approved individual deadline.");
    await student
      .getByRole("button", { name: "Submit assignment", exact: true })
      .click();
    await expect(
      student.getByText("Your work has been submitted."),
    ).toBeVisible();
    const submissions = await (
      await page.request.get(`/api/assignments/${assignment._id}/submissions`)
    ).json();
    expect(submissions.items[0].late).toBe(false);
    expect(submissions.assignment.dueDate).toBe(assignment.dueDate);
  } finally {
    await ctx.close();
    await page.request.delete(`/api/courses/${course._id}`, {
      headers: { Origin: origin },
    });
  }
});

test("whole-class approval is explicit and updates another enrolled student without sharing the reason", async ({
  page,
  browser,
}) => {
  await login(page);
  const { course, assignment } = await create(page, "EXT WEB 2");
  const ctx = await browser.newContext(),
    student = await ctx.newPage(),
    adminCtx = await browser.newContext(),
    admin = await adminCtx.newPage(),
    secondCtx = await browser.newContext(),
    second = await secondCtx.newPage();
  try {
    await login(admin, "admin@classroom.test");
    const account = await admin.request.post("/api/admin/users", {
      headers: { Origin: origin },
      data: {
        name: "Extension classmate",
        email: "extension-classmate@example.edu",
        password: "Classroom2026!",
        role: "student",
        department: "IT",
      },
    });
    expect(account.status()).toBe(201);
    await login(second, "extension-classmate@example.edu");
    await second.request.post(`/api/courses/${course._id}/enroll`, {
      headers: { Origin: origin },
    });
    await login(student, "student@classroom.test");
    await student.request.post(`/api/courses/${course._id}/enroll`, {
      headers: { Origin: origin },
    });
    await openRequest(student, course);
    const reason =
      "Private request details concerning my personal circumstances.";
    await send(student, reason, 5);
    const row = await inboxReview(page, reason);
    await row.getByLabel("Approval applies to").selectOption("class");
    await expect(row.getByText(/all enrolled students/)).toBeVisible();
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(row.getByText(/for the whole class\?/)).toBeVisible();
    await row.getByRole("button", { name: "Confirm approval" }).click();
    await expect(row.locator(".status-badge")).toHaveText("Approved");
    const original = await (
      await student.request.get(`/api/assignments/${assignment._id}/extensions`)
    ).json();
    const classmate = await (
      await second.request.get(`/api/assignments/${assignment._id}/extensions`)
    ).json();
    expect(classmate.assignment.dueDate).toBe(original.assignment.dueDate);
    expect(classmate.items).toHaveLength(0);
    expect(classmate.assignment.dueDate).not.toBe(assignment.dueDate);
    await second.goto("/notifications");
    const notice = second
      .locator("article")
      .filter({ hasText: "Class assignment deadline extended" });
    await expect(notice).toBeVisible();
    await expect(notice).not.toContainText(reason);
  } finally {
    await Promise.all([ctx.close(), adminCtx.close(), secondCtx.close()]);
    await page.request.delete(`/api/courses/${course._id}`, {
      headers: { Origin: origin },
    });
  }
});

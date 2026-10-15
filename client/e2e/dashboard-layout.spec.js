import { test, expect } from "@playwright/test";

test("a single instructor course fills the dashboard column and sparse content fits phone through wide desktop", async ({
  page,
}) => {
  await page.route("**/api/dashboard", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: {
        ...data,
        courses: data.courses.slice(0, 1),
        assignments: [],
        submissions: [],
        announcements: [],
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("instructor@classroom.test");
  await page.getByLabel("Password", { exact: true }).fill("Classroom2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your review queue is clear." }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440, 1920, 2160]) {
    await page.setViewportSize({ width, height: 900 });
    const grid = page.locator(".dashboard-courses");
    const card = grid.locator(".course-card");
    await expect(card).toHaveCount(1);
    const gridBounds = await grid.boundingBox();
    const cardBounds = await card.boundingBox();
    expect(
      Math.abs(cardBounds.width - gridBounds.width),
      `single course fills its column at ${width}px`,
    ).toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no overflow at ${width}px`,
    ).toBe(true);
    const cover = await card.locator(".course-cover").boundingBox();
    const body = await card.locator(".course-card-body").boundingBox();
    if (width > 540) expect(body.x).toBeGreaterThan(cover.x);
    else expect(body.y).toBeGreaterThan(cover.y);
    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: `../docs/screenshots/web-instructor-dashboard-single-course${width === 390 ? "-phone" : ""}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});

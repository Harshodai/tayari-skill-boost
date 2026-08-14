import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/privacy", "/terms", "/methodology", "/about", "/free-scan"];

test.describe("public route smoke", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without a server error`, async ({ page }) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} response`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }

  test("legacy free ATS route redirects to the canonical route", async ({ page }) => {
    await page.goto("/free-ats-scan", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/free-scan$/);
    await expect(page.locator("body")).toBeVisible();
  });
});

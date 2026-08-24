import { expect, test } from "@playwright/test";

test.describe("supporting-code quality", () => {
  test("keeps the public homepage contained and mobile navigation keyboard-operable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("body")).toBeVisible();
    const layout = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

    const mobileMenuTrigger = page.locator('button[aria-controls="mobile-navigation"]');
    await expect(mobileMenuTrigger).toBeVisible();
    await mobileMenuTrigger.click();
    await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeVisible();
    await mobileMenuTrigger.press("Escape");
    await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeHidden();
    await expect(mobileMenuTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("provides a visible keyboard focus target and honors reduced-motion scrolling", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const primaryAction = page.getByRole("link", { name: /start my career rhythm/i }).first();
    await primaryAction.focus();
    await expect(primaryAction).toBeFocused();

    const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(scrollBehavior).toBe("auto");
  });
});

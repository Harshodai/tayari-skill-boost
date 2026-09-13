import { expect, test } from "@playwright/test";

test("records an institutional interest request from pricing", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/v1/waitlist/join", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ status: "accepted" }),
    });
  });

  await page.goto("/pricing");
  await page.getByLabel("Work email for contact sales").fill("pilot@example.com");
  await page.getByRole("button", { name: "Contact Sales" }).click();

  await expect.poll(() => requestBody).toEqual({
    email: "pilot@example.com",
    tier: "institutions",
  });
  await expect(page.getByLabel("Work email for contact sales")).toHaveValue("");
});

import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://127.0.0.1:8083';

test('3. Register User and Complete Flow', async ({ page }) => {
  const unique = Date.now();
  const email = `test-flow-${unique}@example.com`;

  // 3a. Navigate to Auth in signup mode
  await page.goto(`${FRONTEND_URL}/auth?mode=signup`);

  // Fill and submit the signup form.
  await page.fill('input[name="name"]', 'Flow User');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  // Switch to Sign In mode; the URL must now drop the signup query
  // so the register/login path stays unambiguous.
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL((url) => !url.search.includes('mode=signup'));

  // Fill and submit the login form.
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  // After successful auth the user must leave the auth page.
  await page.waitForURL((url) => !url.href.includes('/auth'), { timeout: 5000 });
  await expect(page).not.toHaveURL(/.*\/auth/);
});

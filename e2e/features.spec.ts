import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://127.0.0.1:8083';

test('3. Register User and Complete Flow', async ({ page }) => {
  const unique = Date.now();
  const email = `test-flow-${unique}@example.com`;

  // 3a. Navigate to Auth in signup mode
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning' || msg.text().includes('error')) {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    }
  });
  await page.goto(`${FRONTEND_URL}/auth?mode=signup`);

  // Fill and submit the signup form.
  await page.fill('input[name="name"]', 'Flow User');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'Password12345!');
  await page.click('button[type="submit"]');

  // After successful signup, the user is automatically logged in and redirected.
  await page.waitForURL((url) => !url.href.includes('/auth'), { timeout: 30000 });
  await expect(page).not.toHaveURL(/.*\/auth/);
});

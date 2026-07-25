import { test, expect } from '@playwright/test';

// Critical end-to-end flow test covering landing, dashboard, career intelligence, and logout.

test('critical flow', async ({ request, page }) => {
  const TEST_EMAIL = `critical-flow-${Date.now()}@example.com`;
  const TEST_PASS = 'TayariSuperSecretPassword2026!';

  // 1️⃣ Register test user via API
  const regResponse = await request.post('http://127.0.0.1:8085/api/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  if (!regResponse.ok()) {
    console.log('Register error status:', regResponse.status(), await regResponse.text());
  }
  expect(regResponse.ok()).toBeTruthy();

  // 2️⃣ Log in via API to obtain JWT token
  const loginResponse = await request.post('http://127.0.0.1:8085/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { token } = await loginResponse.json();

  // 3️⃣ Inject token into localStorage and reload dashboard
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
  }, token);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 4️⃣ Verify Dashboard loaded
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('text=day streak')).toBeVisible();

  // 5️⃣ Navigate to Career Intelligence page
  await page.goto('/career-intelligence', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Trending Skills' }).first()).toBeVisible();

  // 6️⃣ Log out via UI
  const signOutBtn = page.locator('button[aria-label="Sign out"]').first();
  await expect(signOutBtn).toBeVisible({ timeout: 5000 });
  await signOutBtn.click();

  // 7️⃣ Expect redirect after logout
  await page.waitForURL(/\/(auth|$)/, { timeout: 5000 });
});

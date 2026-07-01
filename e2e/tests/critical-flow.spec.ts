import { test, expect } from '@playwright/test';

// Critical end-to-end flow test covering landing, dashboard, career intelligence, and logout.

test('critical flow', async ({ request, page }) => {
  // 1️⃣ Register the test user via API.
  await request.post('http://localhost:8085/api/auth/register', {
    data: { email: 'critical-flow-test@example.com', password: 'test12345678' },
  });

  // 2️⃣ Log in via API to obtain JWT token.
  const loginResponse = await request.post('http://localhost:8085/api/auth/login', {
    data: { email: 'critical-flow-test@example.com', password: 'test12345678' },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { token } = await loginResponse.json();

  // 2️⃣ Seed auth token into localStorage before loading the app.
  await page.addInitScript((t) => {
    window.localStorage.setItem('auth_token', t);
  }, token);

  // 3️⃣ Visit the landing page.
  await page.goto('/', { waitUntil: 'networkidle' });

  // 4️⃣ Verify the main heading is visible.
  const heading = page.locator('h1', { hasText: 'The career platform' });
  await expect(heading).toBeVisible();

  // 5️⃣ Navigate to the Dashboard page.
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/dashboard$/);

  // 6️⃣ Ensure GamificationBadge and AchievementsBadge are present.
  await expect(page.locator('text=day streak')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Achievements progress' })).toBeVisible();

  // 7️⃣ Navigate to Career Intelligence page.
  await page.goto('/career-intelligence', { waitUntil: 'networkidle' });

  // 8️⃣ Verify the chart is rendered (section with role="img").
  await expect(page.locator('[role="img"]')).toBeVisible();

  // 9️⃣ Log out via the UI and ensure redirect to the login page.
  await page.locator('button:has(.lucide-log-out), button:has-text("Sign out")').first().click();
  // Expect landing page after logout (user is unauthenticated)
  await expect(page).toHaveURL(/\/$/);
  // Verify a sign‑in link/button is visible again
  await expect(page.locator('a', { hasText: 'Sign In' })).toBeVisible();
});

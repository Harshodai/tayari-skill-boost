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

test('4. Pricing page renders monthly plans by default and toggles to verified submission packs', async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/pricing`, { waitUntil: 'networkidle' });

  // Verify page heading
  await expect(page.getByRole('heading', { name: /Pay for Proof|Credit Packs|Pricing/i }).first()).toBeVisible();

  // 1. Verify prominent billing tabs and default selection
  const monthlyTab = page.getByRole('tab', { name: /Monthly Plans/i });
  const packsTab = page.getByRole('tab', { name: /Verified Submission Packs/i });
  await expect(monthlyTab).toBeVisible();
  await expect(packsTab).toBeVisible();
  await expect(monthlyTab).toHaveAttribute('aria-selected', 'true');
  await expect(packsTab).toHaveAttribute('aria-selected', 'false');

  // 2. Verify the 4 monthly tiers
  const freeCard = page.getByTestId('pricing-card-free');
  const proCard = page.getByTestId('pricing-card-monthly-pro');
  const teamCard = page.getByTestId('pricing-card-monthly-team');
  const enterpriseCard = page.getByTestId('pricing-card-enterprise');

  // Free Tier ($0/mo)
  await expect(freeCard).toBeVisible();
  await expect(freeCard.getByText('Free', { exact: true })).toBeVisible();
  await expect(freeCard.getByText('$0')).toBeVisible();
  await expect(freeCard.getByRole('button', { name: 'Start Free' })).toBeVisible();

  // Pro Tier ($12/mo, marked Popular)
  await expect(proCard).toBeVisible();
  await expect(proCard.getByText('Pro', { exact: true })).toBeVisible();
  await expect(proCard.getByText('$12')).toBeVisible();
  await expect(proCard.getByText('Popular', { exact: true })).toBeVisible();
  await expect(proCard.getByRole('button', { name: /Get Pro/i })).toBeVisible();

  // Team Tier ($49/mo)
  await expect(teamCard).toBeVisible();
  await expect(teamCard.getByText('Team', { exact: true })).toBeVisible();
  await expect(teamCard.getByText('$49')).toBeVisible();
  await expect(teamCard.getByRole('button', { name: /Get Team/i })).toBeVisible();

  // Enterprise Tier (Custom)
  await expect(enterpriseCard).toBeVisible();
  await expect(enterpriseCard.getByText('Enterprise', { exact: true })).toBeVisible();
  await expect(enterpriseCard.getByText('Custom', { exact: true })).toBeVisible();
  await expect(enterpriseCard.getByRole('button', { name: 'Contact Sales' })).toBeVisible();

  // 3. Switch to Verified Submission Packs tab
  await packsTab.click();
  await expect(packsTab).toHaveAttribute('aria-selected', 'true');
  await expect(monthlyTab).toHaveAttribute('aria-selected', 'false');

  // 4. Verify credit packs and guarantee banner
  await expect(page.getByTestId('zero-risk-guarantee')).toBeVisible();
  await expect(page.getByTestId('pricing-card-starter')).toBeVisible();
  await expect(page.getByTestId('pricing-card-pro')).toBeVisible();
  await expect(page.getByTestId('pricing-card-power')).toBeVisible();
});

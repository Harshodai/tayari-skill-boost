import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:8083';
const TEST_EMAIL = 'testjobseeker2026@tayari.app';
const TEST_PASSWORD = 'TayariSuperSecretPassword2026!';

const routesToTest = [
  '/',
  '/auth',
  '/dashboard',
  '/one-shot',
  '/resume',
  '/resume/results',
  '/resume/templates',
  '/typst-studio',
  '/answer-bank',
  '/agent-reach',
  '/cover-letter',
  '/communication',
  '/interview',
  '/interview/prep',
  '/interview/voice-coach',
  '/negotiation',
  '/radar',
  '/skill-gap-radar',
  '/portfolio',
  '/outreach',
  '/analytics-funnel',
  '/privacy-diagnostics',
  '/extension-onboarding',
  '/review-queue',
  '/agents',
  '/advisor',
  '/career-ops',
  '/knowledge-hub',
  '/settings',
  '/api-keys',
  '/linkedin-import',
  '/profile',
  '/jobs',
  '/jobs/autopilot',
  '/roadmap',
  '/pricing',
  '/methodology',
  '/careers',
  '/career-intelligence',
  '/blog',
  '/help',
  '/about',
  '/faq',
  '/contact',
  '/terms',
  '/privacy',
];

test('Find all 404 and 500 errors across all routes', async ({ page }) => {
  test.setTimeout(120000);
  const errorsFound: { route: string; url: string; status: number }[] = [];

  // 1. Login first
  await page.goto(`${FRONTEND_URL}/auth`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 2. Attach error response logger for authenticated session
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errorsFound.push({
        route: page.url(),
        url: response.url(),
        status: response.status(),
      });
    }
  });

  // 3. Visit each route with domcontentloaded wait state
  for (const route of routesToTest) {
    await page.goto(`${FRONTEND_URL}${route}`);
    await page.waitForLoadState('domcontentloaded');
  }

  console.log('=== DISCOVERED 404 AND ERROR RESPONSES ===');
  console.log(JSON.stringify(errorsFound, null, 2));
  console.log('==========================================');
});

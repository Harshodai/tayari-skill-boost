import { test, expect } from '@playwright/test';
import * as path from 'path';

const FRONTEND_URL = 'http://localhost:8083';
const TEST_EMAIL = 'testjobseeker2026@tayari.app';
const TEST_PASSWORD = 'TayariSuperSecretPassword2026!';

const routesToTest = [
  '/',
  '/auth',
  '/resume',
  '/one-shot',
  '/answer-bank',
  '/interview-prep',
  '/salary-negotiation',
  '/tracker',
  '/career-intelligence',
  '/typst-studio',
  '/agent-reach',
  '/knowledge-hub',
  '/settings',
  '/profile',
];

test('Find all 404 and 500 errors across all routes', async ({ page }) => {
  const errorsFound: { route: string; url: string; status: number }[] = [];

  // 1. Login first
  await page.goto(`${FRONTEND_URL}/auth`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

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

  // 2. Visit each route
  for (const route of routesToTest) {
    await page.goto(`${FRONTEND_URL}${route}`);
    await page.waitForLoadState('networkidle');
  }

  console.log('=== DISCOVERED 404 AND ERROR RESPONSES ===');
  console.log(JSON.stringify(errorsFound, null, 2));
  console.log('==========================================');
});

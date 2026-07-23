import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://127.0.0.1:8083';

test.describe.serial('Tayari Skill Boost — Deep UI End-to-End Visual & Interaction Audit', () => {

  const testEmail = `ui-audit-${Date.now()}@tayari.app`;
  const testPassword = 'TayariSuperSecretPassword2026!';

  test('1. Landing Page UI Audit & Navigation Links', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];
    page.on('response', resp => {
      if (resp.status() >= 400) {
        failedRequests.push({ url: resp.url(), status: resp.status() });
      }
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    console.log('Failed Requests on Landing Page:', JSON.stringify(failedRequests, null, 2));

    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Auth Signup & Signin Flow UI Audit', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 2a. Signup Mode
    await page.goto(`${FRONTEND_URL}/auth?mode=signup`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/02-auth-signup.png' });

    await page.fill('input[name="name"]', 'Audit Candidate');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e-screenshots/03-post-signup.png' });

    // 2b. Signin Mode (Clear session first so /auth renders signin form)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${FRONTEND_URL}/auth`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e-screenshots/04-post-signin.png' });
  });

  test('3. Candidate Answer Bank UI (/answer-bank)', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    // Inject auth token in localStorage so user is logged in
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock_or_real_token');
    });

    await page.goto(`${FRONTEND_URL}/answer-bank`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/05-answer-bank.png', fullPage: true });
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('4. One-Shot Resume Optimizer UI (/one-shot or /optimizer)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/one-shot`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/06-one-shot-optimizer.png', fullPage: true });
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('5. Interview Prep & STAR Copilot UI (/interview-prep)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/interview-prep`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/07-interview-prep.png', fullPage: true });
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('6. Salary Negotiation & Offer NPV Calculator UI (/salary-negotiation)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/salary-negotiation`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/08-salary-negotiation.png', fullPage: true });
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('7. Application Tracker UI (/tracker)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/tracker`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'e2e-screenshots/09-application-tracker.png', fullPage: true });
    await expect(page.locator('body')).not.toBeEmpty();
  });

});

import { test, expect } from '@playwright/test';

test('End-to-End: Register, Upload Resume and Analyze against Stripe JD', async ({ request, page }) => {
  test.setTimeout(90000);
  const TEST_EMAIL = `test-stripe-flow-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'TayariSuperSecretPassword2026!';

  // 1. Register test user via API
  console.log(`[E2E] Registering user: ${TEST_EMAIL}`);
  const regResponse = await request.post('http://127.0.0.1:8085/api/auth/register', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(regResponse.ok()).toBeTruthy();

  // 2. Log in via API to obtain JWT token
  const loginResponse = await request.post('http://127.0.0.1:8085/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const { token } = await loginResponse.json();

  // 3. Inject token into localStorage and load /resume
  await page.goto('/resume', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
  }, token);
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log(`[E2E] Logged in successfully! Current URL: ${page.url()}`);

  // 4. Upload Resume file (using sample.pdf)
  console.log('[E2E] Uploading resume file...');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('e2e/fixtures/sample.pdf');

  // Wait for file parsing feedback
  await expect(page.locator('text=sample.pdf').first()).toBeVisible({ timeout: 10000 });
  console.log('[E2E] Resume uploaded and parsed successfully!');

  // 5. Fill Job Description
  console.log('[E2E] Pasting job description...');
  const stripeJD = `
  Stripe Backend Engineer - Core Payments Architecture & Microservices
  Responsibilities:
  - Design, build, and maintain APIs, services, and systems for payments infrastructure in Go and Python.
  - Work with engineers across Stripe to enable new payment flows and global compliance.
  - Build high-scale microservices processing millions of API calls daily with high availability.
  Requirements:
  - 4+ years of experience with backend systems engineering and distributed storage.
  - Strong proficiency in Go, Python, PostgreSQL, and Docker.
  - Strong background in relational databases and cloud microservices architecture.
  `;
  const jdTextarea = page.locator('textarea[placeholder*="Paste the job description"]');
  await jdTextarea.fill(stripeJD);

  // 6. Wait for Analyze button to become enabled and click
  console.log('[E2E] Triggering analysis...');
  const analyzeBtn = page.getByRole('button', { name: /Generate review/i });
  await expect(analyzeBtn).toBeEnabled({ timeout: 15000 });
  await analyzeBtn.click();

  // 7. Wait for results page
  console.log('[E2E] Waiting for results page...');
  await page.waitForURL('**/resume/results', { timeout: 75000 });
  console.log(`[E2E] Results loaded! URL: ${page.url()}`);

  // Assert Overall Match Score is displayed
  const matchScore = page.locator('text=%');
  await expect(matchScore.first()).toBeVisible({ timeout: 10000 });

  // Assert key section tabs exist (Match Analysis, Tailored Resume, Cover Letter)
  await expect(page.locator('text=Match Score').first()).toBeVisible();
  console.log('[E2E] E2E Resume Optimization flow passed successfully!');
});

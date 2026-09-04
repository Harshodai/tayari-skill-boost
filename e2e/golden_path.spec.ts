import { test, expect } from '@playwright/test';

test.describe('Golden Path: End-to-End User Flow', () => {
  test('Complete flow: Register -> Upload Resume -> Optimize against Job -> Generate Cover Letter', async ({ request, page }) => {
    test.setTimeout(240000);

    const timestamp = Date.now();
    const TEST_EMAIL = `golden-path-${timestamp}@example.com`;
    const TEST_PASSWORD = 'TayariGoldenPassword2026!';
    const E2E_HEADERS = { 'X-Tayari-Test-Client': `golden-${timestamp}` };

    // 1. Register test user via Go API gateway
    console.log(`[GoldenPath] 1. Registering user: ${TEST_EMAIL}`);
    const regRes = await request.post('http://127.0.0.1:8085/api/auth/register', {
      headers: E2E_HEADERS,
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(regRes.ok()).toBeTruthy();

    // 2. Log in to obtain authenticated JWT
    console.log(`[GoldenPath] 2. Logging in via Go gateway...`);
    const loginRes = await request.post('http://127.0.0.1:8085/api/auth/login', {
      headers: E2E_HEADERS,
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { token } = await loginRes.json();
    expect(token).toBeTruthy();

    // 3. Inject token and load /resume
    console.log(`[GoldenPath] 3. Navigating to /resume with session token...`);
    await page.goto('/resume', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('auth_token', t);
    }, token);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 4. Upload sample PDF resume
    console.log(`[GoldenPath] 4. Uploading sample resume PDF...`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/sample.pdf');
    await expect(page.locator('text=sample.pdf').first()).toBeVisible({ timeout: 15000 });

    // 5. Fill Target Job Description
    console.log(`[GoldenPath] 5. Providing target Job Description...`);
    const jobDescription = `
      Senior Backend Engineer - Distributed Systems
      Company: Stripe
      Requirements:
      - 5+ years experience building distributed microservices in Go and Python.
      - Experience with PostgreSQL, Redis, high-throughput message queues, and containerization.
      - Strong focus on reliability, idempotency, and clean API design.
    `;
    const jdTextarea = page.locator('textarea[placeholder*="Paste the job description"]');
    await jdTextarea.fill(jobDescription);

    // 6. Trigger review generation
    console.log(`[GoldenPath] 6. Triggering optimization analysis...`);
    const analyzeBtn = page.getByRole('button', { name: /Generate review/i });
    await expect(analyzeBtn).toBeEnabled({ timeout: 15000 });
    await analyzeBtn.click();

    // 7. Await results page
    console.log(`[GoldenPath] 7. Waiting for /resume/results...`);
    await page.waitForURL('**/resume/results', { timeout: 180000 });
    await expect(page.locator('text=%').first()).toBeVisible({ timeout: 15000 });
    console.log(`[GoldenPath] Optimization results displayed successfully!`);

    // 8. Navigate to Cover Letter generation
    console.log(`[GoldenPath] 8. Navigating to /cover-letter...`);
    await page.goto('/cover-letter', { waitUntil: 'domcontentloaded' });

    // 9. Load sample preset role
    console.log(`[GoldenPath] 9. Loading sample role preset...`);
    const presetBtn = page.getByRole('button', { name: /Stripe/i }).first();
    if (await presetBtn.isVisible()) {
      await presetBtn.click();
    } else {
      await page.locator('input[placeholder*="Role"]').fill('Senior Backend Engineer');
      await page.locator('input[placeholder*="Company"]').fill('Stripe');
      await page.locator('textarea[placeholder*="job description"]').fill(jobDescription);
    }

    // 10. Generate cover letter
    console.log(`[GoldenPath] 10. Generating cover letter...`);
    const generateCoverBtn = page.getByRole('button', { name: /Generate/i });
    await expect(generateCoverBtn).toBeEnabled();
    await generateCoverBtn.click();

    const coverLetterResult = page.locator('div.whitespace-pre-wrap');
    await expect(coverLetterResult).toBeVisible({ timeout: 15000 });
    const coverLetterText = await coverLetterResult.textContent();
    expect(coverLetterText?.trim().length).toBeGreaterThan(0);

    console.log(`[GoldenPath] Golden Path completed successfully!`);
  });
});

import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const FRONTEND_URL = 'http://localhost:8083';

test('End-to-End: Register, Upload Resume and Analyze against Stripe JD', async ({ page }) => {
  test.setTimeout(90000); // 90 seconds timeout for AI generation / parsing

  const unique = Date.now();
  const email = `test-stripe-flow-${unique}@example.com`;
  const password = 'Password12345!';

  console.log(`[E2E] Registering user: ${email}`);

  // 1. Go to signup page
  await page.goto(`${FRONTEND_URL}/auth?mode=signup`, { waitUntil: 'networkidle' });

  // 2. Fill and submit the signup form
  await page.fill('input[name="name"]', 'Harshodai Kolluru');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Since we fixed Auth.tsx, it should auto-login and redirect to /resume
  console.log('[E2E] Waiting for auto-login redirect...');
  await page.waitForURL((url) => !url.href.includes('/auth'), { timeout: 15000 });
  console.log(`[E2E] Logged in successfully! Current URL: ${page.url()}`);

  // 3. Upload the resume file
  console.log('[E2E] Uploading resume file...');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('/Users/harshodaikolluru/Downloads/Kolluru_Harshodai_Resume.pdf');

  // Wait for file parsing completion (i.e. name of the file is rendered or no error)
  await page.waitForSelector('text=Kolluru_Harshodai_Resume.pdf', { timeout: 10000 });
  console.log('[E2E] Resume uploaded and parsed successfully!');

  // 4. Read Stripe JD from scratch file
  const stripeJd = fs.readFileSync('/Users/harshodaikolluru/.gemini/antigravity-ide/scratch/stripe_jd.txt', 'utf8');

  // 5. Paste the job description
  console.log('[E2E] Pasting job description...');
  const jdTextarea = page.locator('textarea[placeholder^="Paste the job description"]');
  await jdTextarea.fill(stripeJd);

  // 6. Click "Analyze Resume" button
  console.log('[E2E] Triggering analysis...');
  const analyzeBtn = page.locator('button:has-text("Analyze Resume")');
  await expect(analyzeBtn).toBeEnabled();
  await analyzeBtn.click();

  // 7. Wait for results page
  console.log('[E2E] Waiting for results page...');
  await page.waitForURL('**/resume/results', { timeout: 60000 });
  console.log(`[E2E] Results loaded! URL: ${page.url()}`);

  // Assert Overall Match Score is displayed
  const scoreText = page.locator('text=Overall Match Score');
  await expect(scoreText).toBeVisible({ timeout: 10000 });

  // Assert ATS Score is displayed on the page
  const scoreValue = page.locator('text=%').first();
  const score = await scoreValue.textContent();
  console.log(`[E2E] Final ATS Score text: ${score}`);

  // Take a screenshot of the results
  await page.screenshot({ path: '/Users/harshodaikolluru/.gemini/antigravity-ide/scratch/results_success.png', fullPage: true });
  console.log('[E2E] Screenshot saved to scratch/results_success.png');
});

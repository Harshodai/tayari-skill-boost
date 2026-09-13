import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://127.0.0.1:8083';
const API_URL = 'http://127.0.0.1:8085/api';

// Enforce compliant 12+ character password per AGENTS.md constraints
const TEST_PASSWORD = 'TayariTestPass12345!';
const TEST_NAME = 'Candidate Verification User';

test.describe.serial('Tayari Skill Boost — Credit Billing, Candidate Flow & Local Stack Verification', () => {

  const uniqueId = Date.now();
  const testEmail = `candidate-${uniqueId}@tayari.app`;
  let authToken = '';

  // ---------------------------------------------------------------------------
  // 1. User Registration Flow (12+ character compliant password)
  // ---------------------------------------------------------------------------
  test('1. Register new user via UI with 12+ char password and auto-login', async ({ page }) => {
    // Navigate directly to registration page
    await page.goto(`${FRONTEND_URL}/auth?mode=signup`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible();

    // Verify registration form fields
    const nameInput = page.locator('input[name="name"]');
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Fill form with valid details and 12+ character password
    await nameInput.fill(TEST_NAME);
    await emailInput.fill(testEmail);
    await passwordInput.fill(TEST_PASSWORD);

    // Verify password requirements / strength indicator
    await expect(page.locator('text=Min 12 characters').or(page.locator('text=Password')).first()).toBeVisible();

    // Submit registration
    await submitBtn.click();

    // Wait for redirect away from /auth upon successful authentication
    await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/auth/);

    // Extract auth token from browser localStorage
    authToken = await page.evaluate(() => localStorage.getItem('auth_token') || '');
    expect(authToken).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 2. Pricing & Credit Billing Packs Verification
  // ---------------------------------------------------------------------------
  test('2. Verify /pricing renders credit packs (Starter, Pro, Power) and verifies subscription tiers replaced', async ({ page }) => {
    // 2a. Route mock if client fetches /v1/billing/credits/packs
    await page.route('**/v1/billing/credits/packs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          billing_enabled: true,
          packs: [
            {
              id: 'starter',
              key: 'starter',
              name: 'Starter Pack',
              credits: 10,
              price: 19,
              price_formatted: '$19',
              unit_price: '$1.90/sub',
              popular: false,
              best_value: false,
            },
            {
              id: 'pro',
              key: 'pro',
              name: 'Pro Pack',
              credits: 35,
              price: 49,
              price_formatted: '$49',
              unit_price: '$1.40/sub',
              popular: true,
              best_value: false,
            },
            {
              id: 'power',
              key: 'power',
              name: 'Power Pack',
              credits: 100,
              price: 99,
              price_formatted: '$99',
              unit_price: '$0.99/sub',
              popular: false,
              best_value: true,
            },
          ],
        }),
      });
    });

    // 2b. Navigate to UI /pricing
    await page.goto(`${FRONTEND_URL}/pricing`, { waitUntil: 'networkidle' });

    // Verify page headings & verified-only pricing messaging
    await expect(page.getByRole('heading', { name: /Pay for Proof|Credit Packs|Pricing/i }).first()).toBeVisible();
    await expect(page.getByTestId('zero-risk-guarantee')).toBeVisible();

    // Verify Starter Pack (10 credits, $19, $1.90/sub)
    const starterCard = page.getByTestId('pricing-card-starter');
    await expect(starterCard).toBeVisible();
    await expect(starterCard.getByText('Starter Pack')).toBeVisible();
    await expect(starterCard.getByText('$19', { exact: true })).toBeVisible();
    await expect(starterCard.getByText('$1.90/sub').first()).toBeVisible();
    await expect(starterCard.getByRole('button', { name: /Buy 10 Credits/i })).toBeVisible();

    // Verify Pro Pack (35 credits, $49, $1.40/sub, "Active search" badge --
    // renamed from "Most Popular" as part of the product-story copy pass)
    const proCard = page.getByTestId('pricing-card-pro');
    await expect(proCard).toBeVisible();
    await expect(proCard.getByText('Pro Pack')).toBeVisible();
    await expect(proCard.getByText('$49', { exact: true })).toBeVisible();
    await expect(proCard.getByText('$1.40/sub').first()).toBeVisible();
    await expect(proCard.getByText('Active search', { exact: true })).toBeVisible();
    await expect(proCard.getByRole('button', { name: /Buy 35 Credits/i })).toBeVisible();

    // Verify Power Pack (100 credits, $99, $0.99/sub, Best Value badge)
    const powerCard = page.getByTestId('pricing-card-power');
    await expect(powerCard).toBeVisible();
    await expect(powerCard.getByText('Power Pack')).toBeVisible();
    await expect(powerCard.getByText('$99', { exact: true })).toBeVisible();
    await expect(powerCard.getByText('$0.99/sub').first()).toBeVisible();
    await expect(powerCard.getByText('Best Value', { exact: true })).toBeVisible();
    await expect(powerCard.getByRole('button', { name: /Buy 100 Credits/i })).toBeVisible();

    // Verify refund / 0-charge safety policy statement. Anchored on the
    // stable data-testid rather than exact copy -- the "Zero Risk" framing
    // was reworded to "Transparent credit policy" as part of a truthfulness
    // pass (unconditional "zero risk" is exactly the kind of claim the
    // project's own truthfulness rules forbid), and copy is expected to
    // keep evolving independent of this test's job (verifying the
    // debit-only-on-verified-receipt policy is stated at all).
    const creditPolicyBanner = page.getByTestId('zero-risk-guarantee');
    await expect(creditPolicyBanner).toBeVisible();
    await expect(creditPolicyBanner.getByText(/debited only when a verified submission receipt/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 3. Free ATS Resume Scan Flow
  // ---------------------------------------------------------------------------
  test('3. Verify /free-scan with resume & job description input and validation', async ({ page }) => {
    // 3a. Verify /free-ats-scan redirects to /free-scan
    await page.goto(`${FRONTEND_URL}/free-ats-scan`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/free-scan/);

    // 3b. Verify empty input validation
    // "Review my resume" -- renamed from "Scan My Resume" as part of the
    // same truthfulness copy pass ("review" doesn't imply an authoritative
    // pass/fail verdict the way "scan" can read).
    const scanButton = page.getByRole('button', { name: /Review my resume/i });
    await expect(scanButton).toBeVisible();
    await scanButton.click();
    await expect(page.locator('text=Please fill in both fields before scanning.').first()).toBeVisible();

    // 3c. Mock public analyze-text endpoint for deterministic fast score assertions
    await page.route('**/v1/public/analyze-text', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overall_score: 87,
          score_breakdown: {
            skills: 90,
            experience: 85,
            education: 88,
          },
          matching_skills: ['React', 'TypeScript', 'Go', 'PostgreSQL', 'Docker'],
          missing_skills: ['Kubernetes'],
          recommendations: ['Highlight experience with distributed architecture and Kubernetes.'],
        }),
      });
    });

    // 3d. Fill resume and job description inputs
    const sampleResume = `
      John Doe — Senior Full-Stack Engineer
      Technical Skills: React, TypeScript, Go, PostgreSQL, Docker, CI/CD pipelines, REST APIs.
      Experience: Built scalable microservices handling 100K+ daily active users.
    `;
    const sampleJD = `
      Senior Software Engineer
      Requirements: Strong background in React, TypeScript, Go, and PostgreSQL. Experience with Docker and microservices.
    `;

    await page.locator('textarea#resume-text').fill(sampleResume);
    await page.locator('textarea#job-description').fill(sampleJD);

    // Trigger ATS Scan
    await scanButton.click();

    // Verify ATS match score rendering. "ATS Match Score" / "Strong match!"
    // were reworded to "Role-alignment signal" / "Strong alignment signal..."
    // as part of a truthfulness copy pass -- softer "signal" framing instead
    // of an absolute match claim, and an explicit prompt to review rather
    // than trust the number outright.
    await expect(page.locator('text=Role-alignment signal').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=87%').first()).toBeVisible();
    await expect(page.locator('text=Strong alignment signal').first()).toBeVisible();
    await expect(page.locator('text=React').first()).toBeVisible();
    await expect(page.locator('text=TypeScript').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 4. Onboarding Wizard: Offline Fallback & Local Draft Persistence
  // ---------------------------------------------------------------------------
  test('4. Verify /onboarding draft auto-save, reload restoration and gateway offline fallback', async ({ page }) => {
    // 4a. Navigate to /onboarding
    await page.goto(`${FRONTEND_URL}/onboarding`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Branching Onboarding Wizard/i })).toBeVisible();

    // Step 1: Choose Cross-Domain transition track
    const crossDomainTrack = page.locator('[data-testid="track-cross-domain"]');
    await expect(crossDomainTrack).toBeVisible();
    await crossDomainTrack.click();

    // Proceed to Step 2
    const nextBtn1 = page.getByRole('button', { name: /Next: Role Configuration/i });
    await nextBtn1.click();

    // Step 2: Fill industry inputs
    const currentIndInput = page.locator('[data-testid="input-current-industry"]');
    const targetIndInput = page.locator('[data-testid="input-target-industry"]');
    await expect(currentIndInput).toBeVisible();

    await currentIndInput.fill('FinTech / Banking');
    await targetIndInput.fill('AI & Distributed Systems');

    // Add Transferable Skill
    const skillInput = page.locator('[data-testid="input-skill"]');
    await skillInput.fill('Distributed Consensus');
    await page.getByRole('button', { name: /^Add$/i }).click();
    await expect(page.locator('text=Distributed Consensus').first()).toBeVisible();

    // 4b. Verify draft is saved to localStorage
    const savedDraftRaw = await page.evaluate(() => localStorage.getItem('tayari_onboarding_draft'));
    expect(savedDraftRaw).toBeTruthy();
    const draftObj = JSON.parse(savedDraftRaw!);
    expect(draftObj.transitionType).toBe('cross_domain');
    expect(draftObj.currentIndustry).toBe('FinTech / Banking');
    expect(draftObj.targetIndustry).toBe('AI & Distributed Systems');
    expect(draftObj.transferableSkills).toContain('Distributed Consensus');

    // 4c. Verify persistence across page reload
    await page.reload({ waitUntil: 'networkidle' });
    const draftAfterReload = await page.evaluate(() => localStorage.getItem('tayari_onboarding_draft'));
    expect(draftAfterReload).toBeTruthy();

    // 4d. Verify Gateway Offline Fallback Banner
    // Simulate backend gateway 502 outage on profile fetch
    await page.route('**/v1/profile', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bad Gateway' }),
      });
    });

    await page.goto(`${FRONTEND_URL}/onboarding`, { waitUntil: 'networkidle' });
    const offlineBanner = page.locator('[data-testid="gateway-offline-banner"]');
    await expect(offlineBanner).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="saved-fields-list"]')).toBeVisible();
    await expect(page.locator('text=Backend Gateway Offline — Local Mode Active').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 5. Pipeline & Outcomes Receipt Proof Rendering (Verified, Failed, Unverifiable)
  // ---------------------------------------------------------------------------
  test('5. Verify /pipeline and /outcomes receipt proof badges and credit charging rules', async ({ page }) => {
    // 5a. Set up authenticated session
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'domcontentloaded' });
    if (authToken) {
      await page.evaluate((token) => {
        localStorage.setItem('auth_token', token);
      }, authToken);
    }

    // Fixture mock data for saved jobs with 3 distinct receipt types:
    // 1) Verified submission (1 credit debited)
    // 2) Failed submission (0 credits charged)
    // 3) Unverifiable candidate-confirmed submission (0 credits charged)
    const mockJobs = [
      {
        id: 'job-verified-1',
        title: 'Principal Distributed Systems Engineer',
        company: 'Stripe',
        location: 'San Francisco, CA',
        url: 'https://stripe.com/jobs/101',
        stage: 'applied',
        saved_at: new Date().toISOString(),
        receipt: {
          verified: true,
          failed: false,
          status: 'verified',
          confirmationNumber: 'STRIPE-APP-884920',
          confirmationCode: 'STRIPE-APP-884920',
          submittedAt: new Date().toISOString(),
          atsVendor: 'Greenhouse',
        },
      },
      {
        id: 'job-failed-2',
        title: 'Lead Platform Architect',
        company: 'Netflix',
        location: 'Los Gatos, CA',
        url: 'https://netflix.com/jobs/202',
        stage: 'applied',
        saved_at: new Date().toISOString(),
        receipt: {
          verified: false,
          failed: true,
          status: 'failed',
          confirmationNumber: null,
          confirmationCode: null,
          submittedAt: new Date().toISOString(),
          failureReason: 'Session timed out during upload',
          atsVendor: 'Workday',
        },
      },
      {
        id: 'job-unverifiable-3',
        title: 'Staff AI Infrastructure Engineer',
        company: 'OpenAI',
        location: 'Remote',
        url: 'https://openai.com/careers/303',
        stage: 'applied',
        saved_at: new Date().toISOString(),
        receipt: {
          verified: false,
          failed: false,
          status: 'unverifiable',
          confirmationNumber: null,
          confirmationCode: null,
          submittedAt: new Date().toISOString(),
          failureReason: null,
          atsVendor: null,
        },
      },
    ];

    const mockReceipts = [
      {
        id: 'rec-1',
        job_url: 'https://stripe.com/jobs/101',
        company: 'Stripe',
        job_title: 'Principal Distributed Systems Engineer',
        verified: true,
        outcome: 'verified',
        confirmation_number: 'STRIPE-APP-884920',
        confirmation_text: 'Thank you for your application.',
        submitted_at: new Date().toISOString(),
        ats_vendor: 'Greenhouse',
      },
      {
        id: 'rec-2',
        job_url: 'https://netflix.com/jobs/202',
        company: 'Netflix',
        job_title: 'Lead Platform Architect',
        verified: false,
        outcome: 'failed',
        confirmation_number: null,
        confirmation_text: 'Session timed out during upload',
        submitted_at: new Date().toISOString(),
        ats_vendor: 'Workday',
      },
      {
        id: 'rec-3',
        job_url: 'https://openai.com/careers/303',
        company: 'OpenAI',
        job_title: 'Staff AI Infrastructure Engineer',
        verified: false,
        outcome: 'unverifiable',
        confirmation_number: null,
        confirmation_text: 'Candidate manually marked applied without ATS receipt',
        submitted_at: new Date().toISOString(),
        ats_vendor: null,
      },
    ];

    // Intercept backend endpoints for saved jobs & receipts
    await page.route('**/v1/jobs/saved', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobs: mockJobs }),
      });
    });

    await page.route('**/v1/jobs/receipts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ receipts: mockReceipts }),
      });
    });

    await page.route('**/rest/v1/submission_receipts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReceipts),
      });
    });

    await page.route('**/rest/v1/saved_jobs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockJobs),
      });
    });

    // -------------------------------------------------------------------------
    // Test /pipeline board
    // -------------------------------------------------------------------------
    await page.goto(`${FRONTEND_URL}/pipeline`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Application Pipeline|Pipeline/i }).first()).toBeVisible();

    // Verify stage columns
    await expect(page.locator('text=SAVED').or(page.locator('text=Saved')).first()).toBeVisible();
    await expect(page.locator('text=APPLIED').or(page.locator('text=Applied')).first()).toBeVisible();

    // 1) Verify Verified Receipt on Pipeline Card
    const verifiedCard = page.locator('[data-testid="receipt-verified"]').first();
    await expect(verifiedCard).toBeVisible();
    await expect(verifiedCard).toContainText('VERIFIED RECEIPT');
    await expect(verifiedCard).toContainText('STRIPE-APP-884920');
    await expect(verifiedCard).toContainText('1 Credit Debited');

    // 2) Verify Failed Receipt on Pipeline Card
    const failedCard = page.locator('[data-testid="receipt-failed"]').first();
    await expect(failedCard).toBeVisible();
    await expect(failedCard).toContainText('SUBMISSION FAILED');
    await expect(failedCard).toContainText('Session timed out during upload');

    // 3) Verify Unverifiable Receipt on Pipeline Card
    const unverifiableCard = page.locator('[data-testid="receipt-unverifiable"]').first();
    await expect(unverifiableCard).toBeVisible();
    await expect(unverifiableCard).toContainText('UNVERIFIABLE / CANDIDATE CONFIRMED');
    await expect(unverifiableCard).toContainText('0 Credits Charged');

    // -------------------------------------------------------------------------
    // Test /outcomes receipts & auditability
    // -------------------------------------------------------------------------
    await page.goto(`${FRONTEND_URL}/outcomes`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Application Outcomes|Outcomes/i }).first()).toBeVisible();

    // Verify receipt cards exist on outcomes page
    const outcomesVerified = page.locator('[data-testid="receipt-card-verified"]').first();
    const outcomesFailed = page.locator('[data-testid="receipt-card-failed"]').first();
    const outcomesUnverifiable = page.locator('[data-testid="receipt-card-unverifiable"]').first();

    await expect(outcomesVerified).toBeVisible();
    await expect(outcomesVerified).toContainText('VERIFIED RECEIPT');
    await expect(outcomesVerified).toContainText('1 Credit Debited');
    await expect(outcomesVerified).toContainText('STRIPE-APP-884920');

    await expect(outcomesFailed).toBeVisible();
    await expect(outcomesFailed).toContainText('SUBMISSION FAILED');
    await expect(outcomesFailed).toContainText('0 Credits Charged (Free)');
    await expect(outcomesFailed).toContainText('Session timed out during upload');

    await expect(outcomesUnverifiable).toBeVisible();
    await expect(outcomesUnverifiable).toContainText('UNVERIFIABLE / CANDIDATE CONFIRMED');
    await expect(outcomesUnverifiable).toContainText('0 Credits Charged');
  });
});

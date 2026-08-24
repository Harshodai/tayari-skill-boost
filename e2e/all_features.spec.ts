import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://127.0.0.1:8083';
const API_URL = 'http://127.0.0.1:8085/api';
const PYTHON_API_URL = 'http://127.0.0.1:8002';

const TEST_EMAIL = `e2e-suite-${Date.now()}@tayari.app`;
const TEST_PASS = 'TayariSuperSecretPassword2026!'; // Minimum 12 characters per repository policy
const E2E_CLIENT_HEADERS = { 'X-Tayari-Test-Client': `features-${Date.now()}` };

test.describe.serial('Tayari Skill Boost — End-to-End API & UI Verification Suite', () => {

  let userToken: string = '';

  // -------------------------------------------------------------------------
  // 1. Health Check Endpoints
  // -------------------------------------------------------------------------
  test('1. API Health Checks (Go Gateway & Python Engine)', async ({ request }) => {
    const goHealth = await request.get(`${API_URL}/health`);
    expect(goHealth.status()).toBe(200);
    const goData = await goHealth.json();
    expect(goData.status).toBe('ok');
    expect(goData.service).toBe('go-backend');

    const pyHealth = await request.get(`${PYTHON_API_URL}/health`);
    expect(pyHealth.status()).toBe(200);
    const pyData = await pyHealth.json();
    expect(pyData.status).toBe('ok');
  });

  // -------------------------------------------------------------------------
  // 2. Authentication API (Register & Login)
  // -------------------------------------------------------------------------
  test('2. User Registration and Login via Go API Gateway', async ({ request }) => {
    // Register User
    const regRes = await request.post(`${API_URL}/v1/auth/register`, {
      headers: E2E_CLIENT_HEADERS,
      data: {
        email: TEST_EMAIL,
        password: TEST_PASS,
        full_name: 'E2E Test Candidate',
      },
    });
    expect([200, 201]).toContain(regRes.status());
    const regBody = await regRes.json();
    expect(regBody.email).toBe(TEST_EMAIL);

    // Login User
    const loginRes = await request.post(`${API_URL}/v1/auth/login`, {
      headers: E2E_CLIENT_HEADERS,
      data: {
        email: TEST_EMAIL,
        password: TEST_PASS,
      },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.token).toBeDefined();
    userToken = loginBody.token;
  });

  // -------------------------------------------------------------------------
  // 3. Candidate QA Answer Bank (API)
  // -------------------------------------------------------------------------
test('3. Candidate Answer Bank Match (API)', async ({ request }) => {
  expect(userToken).toBeTruthy();
  const applicationId = `e2e-answer-bank-${Date.now()}`;
  const save = await request.put(`${API_URL}/v1/candidate/answers`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: {
      answers: { work_authorization: 'Yes' },
      application_id: applicationId,
      confirm_sensitive: true,
    },
  });
  expect(save.status()).toBe(200);
  const res = await request.post(`${API_URL}/v1/candidate-bank/match`, {
    headers: { Authorization: `Bearer ${userToken}` },
    data: {
      question_text: 'Are you legally authorized to work in the United States?',
      application_id: applicationId,
    },
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.matched).toBe(true);
  expect(data.category).toBe('work_authorization');
  expect(data.value).toBe('Yes');
});

  // -------------------------------------------------------------------------
  // 4. ATS Signature Detection (API)
  // -------------------------------------------------------------------------
  test('4. Target ATS Signature Detection (API)', async ({ request }) => {
    expect(userToken).toBeTruthy();
    const res = await request.post(`${API_URL}/v1/ats/detect`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        url: 'https://stripe.myworkdayjobs.com/en-US/careers/job/R10294',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.vendor).toBe('workday');
    expect(data.displayName).toBe('Workday ATS');
    expect(data.single_column_required).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Resume Truth Gate Guardrail (API)
  // -------------------------------------------------------------------------
  test('5. Resume Truth Gate Guardrail (API)', async ({ request }) => {
    expect(userToken).toBeTruthy();
    const res = await request.post(`${API_URL}/v1/guardrails/truth-check`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        original_text: 'Developed Go microservices. B.S. Computer Science.',
        optimized_text: 'Architected high-throughput Go microservices. B.S. Computer Science.',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.truth_score).toBe(100);
    expect(data.passed).toBe(true);
    expect(data.flagged_entities).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 6. Recruiter Intelligence & Cold Outreach (API)
  // -------------------------------------------------------------------------
  test('6. Recruiter Intelligence & Outreach Lookup (API)', async ({ request }) => {
    expect(userToken).toBeTruthy();
    const res = await request.post(`${API_URL}/v1/recruiter/lookup`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        company_name: 'Stripe',
        job_title: 'Senior Staff Engineer',
        hiring_manager_name: 'Alex Rivera',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.company_domain).toBe('stripe.com');
    expect(data.email_pattern).toBe('first.last@stripe.com');
    expect(data.suggested_emails).toContain('alex.rivera@stripe.com');
    expect(data.cold_outreach_subject).toBeDefined();
    expect(data.referral_intro_template).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 7. Total Comp 4-Year NPV Calculator (API)
  // -------------------------------------------------------------------------
  test('7. Total Comp NPV Calculator (API)', async ({ request }) => {
    expect(userToken).toBeTruthy();
    const res = await request.post(`${API_URL}/v1/offer/calculate`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        company_name: 'Google',
        job_title: 'L6 Software Engineer',
        base_salary: 210000,
        annual_bonus_pct: 20,
        signing_bonus: 40000,
        equity_total_value: 360000,
        equity_vesting_years: 4,
        col_index: 100.0,
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.company_name).toBe('Google');
    expect(data.year_1_total_comp).toBe(390400);
    expect(data.annualized_4yr_npv).toBeGreaterThan(300000);
    expect(data.breakdown.base_salary).toBe(210000);
  });

  // -------------------------------------------------------------------------
  // 8. Live Interview Audio Copilot (API)
  // -------------------------------------------------------------------------
  test('8. Live Interview Audio Copilot STAR Generator (API)', async ({ request }) => {
    // ponytail: this used to assert 200 unconditionally, which only ever
    // passed in an environment with a live LLM provider configured -- a real
    // CI/staging checkout without secrets gets an honest 503
    // ai_service_unavailable from this route (see live_interview_copilot.py,
    // fixed earlier to never fabricate a STAR answer on failure) and this
    // test must not treat that as a bug. Accept either outcome, but require
    // each to be internally honest: 200 must carry real STAR content, 503
    // must carry the documented error shape, never a partial/garbled body.
    expect(userToken).toBeTruthy();
    const res = await request.post(`${API_URL}/v1/interview/copilot`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: {
        interviewer_transcript: 'Tell me about a time you resolved a major production outage under pressure.',
        question: 'Tell me about a time you resolved a major production outage under pressure.',
        target_role: 'Senior Staff Infrastructure Engineer',
      },
    });
    expect([200, 503]).toContain(res.status());
    const data = await res.json();
    if (res.status() === 503) {
      expect(data.error).toBe('ai_service_unavailable');
      return;
    }
    expect(data.star_framework.situation).toBeDefined();
    expect(data.star_framework.task).toBeDefined();
    expect(data.star_framework.action).toBeDefined();
    expect(data.star_framework.result).toBeDefined();
    expect(data.suggested_metrics.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 9. Career Ops Portals CRUD (API)
  // -------------------------------------------------------------------------
  test('9. Career Ops Target Portals CRUD (API)', async ({ request }) => {
    expect(userToken).toBeTruthy();
    const authHeaders = { Authorization: `Bearer ${userToken}` };

    // Create
    const createRes = await request.post(`${API_URL}/v1/career-ops/portals`, {
      headers: authHeaders,
      data: { name: 'AutomatedE2EPortal', careers_url: 'https://e2e.example.com/careers' },
    });
    expect(createRes.status()).toBe(200);

    // List
    const listRes = await request.get(`${API_URL}/v1/career-ops/portals`, { headers: authHeaders });
    expect(listRes.status()).toBe(200);
    const portals = (await listRes.json()).portals || [];
    expect(portals.length).toBeGreaterThan(0);
    const createdPortal = portals.find((p: any) => p.name === 'AutomatedE2EPortal');
    expect(createdPortal).toBeDefined();

    // Patch
    const patchRes = await request.patch(`${API_URL}/v1/career-ops/portals/${createdPortal.id}`, {
      headers: authHeaders,
      data: { enabled: false },
    });
    expect(patchRes.status()).toBe(200);

    // Delete
    const deleteRes = await request.delete(`${API_URL}/v1/career-ops/portals/${createdPortal.id}`, {
      headers: authHeaders,
    });
    expect(deleteRes.status()).toBe(200);
  });

  // -------------------------------------------------------------------------
  // 10. Frontend UI Navigation & Authenticated User Flows
  // -------------------------------------------------------------------------
  test('10a. UI Navigation — Landing Page & App Shell', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Tayari/i);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('10b. UI Navigation — Auth Page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/auth`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('10c. UI Auth Flow — Signup & Redirect', async ({ page }) => {
    const flowEmail = `ui-test-${Date.now()}@tayari.app`;
    await page.goto(`${FRONTEND_URL}/auth?mode=signup`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="name"]', 'UI Test Candidate');
    await page.fill('input[name="email"]', flowEmail);
    await page.fill('input[name="password"]', TEST_PASS);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);
    expect(page.url()).toBeDefined();
  });

  test('10d. UI Authenticated Session — Answer Bank Page', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ email: 'e2e-test@tayari.app', name: 'E2E Candidate' }));
    }, userToken);

    await page.goto(`${FRONTEND_URL}/answer-bank`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
  });

});

import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://127.0.0.1:8083';
const API_URL = 'http://127.0.0.1:8085/api';

const TEST_EMAIL = 'e2e-test@example.com';
const TEST_PASS = 'test12345678';

test.describe('Tayari Skill Boost — End to End Smoke', () => {

  test('1. Homepage loads successfully', async ({ page }) => {
    const resp = await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('2. Health endpoints respond 200', async ({ request }) => {
    const go = await request.get(`${API_URL}/health`);
    expect(go.status()).toBe(200);

    const py = await request.get('http://127.0.0.1:8002/health');
    expect(py.status()).toBe(200);
  });

  test('3. Register a new user via API', async ({ request }) => {
    // Try to register (may already exist from prior run)
    const res = await request.post(`${API_URL}/auth/register`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    // 200 = success, 409 = already exists — both acceptable
    expect([200, 409]).toContain(res.status());
  });

  test('4. Login and get token', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
  });

  test('5. Authenticated: GET /api/v1/career-ops/portals', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();

    const res = await request.get(`${API_URL}/v1/career-ops/portals`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('portals');
  });

  test('6. Authenticated: CRUD career-ops portals', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };

    // Create
    const create = await request.post(`${API_URL}/v1/career-ops/portals`, {
      headers: auth,
      data: { name: 'E2ETest', careers_url: 'https://e2e-test.com/jobs' },
    });
    expect(create.status()).toBe(200);

    // List
    const list = await request.get(`${API_URL}/v1/career-ops/portals`, { headers: auth });
    expect(list.status()).toBe(200);
    const portals = (await list.json()).portals || [];
    expect(portals.length).toBeGreaterThan(0);
    const portalId = portals[portals.length - 1].id;

    // Toggle (PATCH)
    const patch = await request.patch(`${API_URL}/v1/career-ops/portals/${portalId}`, {
      headers: auth,
      data: { enabled: false },
    });
    expect(patch.status()).toBe(200);

    // Delete
    const del = await request.delete(`${API_URL}/v1/career-ops/portals/${portalId}`, {
      headers: auth,
    });
    expect(del.status()).toBe(200);
  });

  test('7. Authenticated: CRUD story bank', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };

    // Save stories
    const save = await request.post(`${API_URL}/v1/career-ops/story-bank`, {
      headers: auth,
      data: {
        stories: [
          { requirement: 'Lead', situation: 'Led team', task: 'Deliver', action: 'Built', result: 'Shipped', reflection: 'Learnt' },
        ],
      },
    });
    expect(save.status()).toBe(200);

    // Get
    const get = await request.get(`${API_URL}/v1/career-ops/story-bank`, { headers: auth });
    expect(get.status()).toBe(200);
    const body = await get.json();
    expect(body.stories.length).toBe(1);

    // Delete
    const del = await request.delete(`${API_URL}/v1/career-ops/story-bank/0`, { headers: auth });
    expect(del.status()).toBe(200);

    // Verify empty
    const get2 = await request.get(`${API_URL}/v1/career-ops/story-bank`, { headers: auth });
    expect((await get2.json()).stories.length).toBe(0);
  });

  test('8. Authenticated: GET /api/v1/communication/suggestions', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();

    const res = await request.get(`${API_URL}/v1/communication/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('suggestions');
  });

  test('9. Authenticated: GET /api/v1/career-ops/stats', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();

    const res = await request.get(`${API_URL}/v1/career-ops/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  test('10. Archive routes parity', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();
    const auth = { Authorization: `Bearer ${token}` };

    for (const path of ['career-ops/portals', 'career-ops/stats', 'career-ops/story-bank']) {
      const v1 = await request.get(`${API_URL}/v1/${path}`, { headers: auth });
      const arch = await request.get(`${API_URL}/${path}`, { headers: auth });
      expect(v1.status()).toBe(200);
      expect(arch.status()).toBe(200);
    }
  });

  test('11. Dashboard stats endpoint', async ({ request }) => {
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    const { token } = await login.json();

    const res = await request.get(`${API_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  test('12. Unauthenticated requests return 401', async ({ request }) => {
    const endpoints = [
      '/v1/career-ops/portals',
      '/v1/career-ops/story-bank',
      '/v1/communication/suggestions',
      '/dashboard/stats',
    ];
    for (const ep of endpoints) {
      const res = await request.get(`${API_URL}${ep}`);
      expect(res.status()).toBe(401);
    }
  });
});

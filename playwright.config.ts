import { defineConfig } from '@playwright/test';

const testPort = Number(process.env.PLAYWRIGHT_PORT || 8083);
const testBaseUrl = `http://127.0.0.1:${testPort}`;
const e2eClientHeader = process.env.TAYARI_E2E_TEST_MODE === 'true'
  ? `playwright-${process.pid}-${Date.now()}`
  : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: testBaseUrl,
    extraHTTPHeaders: e2eClientHeader
      ? { 'X-Tayari-Test-Client': e2eClientHeader }
      : {},
  },
  webServer: {
    command: `cross-env VITE_SUPABASE_URL=https://ci.example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci VITE_API_URL=https://api.example.com/api VITE_USE_SELF_HOSTED=false pnpm dev --host 127.0.0.1 --port ${testPort}`,
    url: testBaseUrl,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true' || !process.env.CI,
    timeout: 120000,
  },
});

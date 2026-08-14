import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8083',
  },
  webServer: {
    command: 'cross-env VITE_SUPABASE_URL=https://ci.example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci VITE_API_URL=https://api.example.com/api VITE_USE_SELF_HOSTED=false pnpm dev --host 127.0.0.1 --port 8083',
    url: 'http://127.0.0.1:8083',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true' || !process.env.CI,
    timeout: 120000,
  },
});

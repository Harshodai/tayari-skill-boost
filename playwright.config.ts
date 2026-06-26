import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8083',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  },
  webServer: false,
});

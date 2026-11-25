import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 30000 },
  outputDir: '.local/browser-results',
  use: {
    baseURL: 'http://localhost:5174',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: { MATAHR_API_TARGET: 'https://localhost:7143' },
  },
});

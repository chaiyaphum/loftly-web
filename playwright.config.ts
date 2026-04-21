import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 1 Playwright smoke-test configuration.
 *
 * The suite is anonymous-only and runs against staging by default. It
 * exercises 3 critical paths (landing, card index, selector form) plus one
 * admin-guard assertion. See `docs/E2E.md` for the runbook.
 *
 * No Firefox/WebKit in Phase 1 — we keep the matrix to chromium desktop +
 * mobile Chrome (Pixel 5) to keep nightly CI fast and cheap.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL:
      process.env.E2E_BASE_URL ??
      'https://loftly-web-staging-xymb5.ondigitalocean.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});

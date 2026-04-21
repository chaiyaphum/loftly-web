// Placeholder Playwright config — real E2E tests come in Phase 1 Week 3+.
// We keep this file so CI and editors recognize the E2E target, but no tests
// are wired up yet. Install `@playwright/test` before uncommenting.
//
// import { defineConfig, devices } from '@playwright/test';
//
// export default defineConfig({
//   testDir: './e2e',
//   retries: process.env.CI ? 2 : 0,
//   reporter: 'html',
//   use: {
//     baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
//     trace: 'on-first-retry',
//   },
//   projects: [
//     { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
//   ],
// });

export default {};

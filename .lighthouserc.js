/**
 * Lighthouse CI config — runtime performance budget enforcement.
 *
 * Runs Lighthouse against a locally-booted `next start` server. Until a
 * staging Cloudflare Pages preview URL is wired (Phase 1 pending), we
 * assert against localhost with emulated 3G + 4x CPU slowdown to approximate
 * mid-tier Thai mobile network conditions.
 *
 * Thresholds (per DEV_PLAN W14: LCP < 2.5s on 3G):
 *   - Performance    >= 85
 *   - Accessibility  >= 95
 *   - Best Practices >= 90
 *   - SEO            >= 90
 *   - LCP            <= 2500 ms
 *   - CLS            <= 0.1
 *   - Max Potential FID <= 100 ms
 *
 * Update the `url` list when routes are added; update thresholds only with
 * justification in the PR description (see docs/PERFORMANCE.md).
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 60000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/cards',
        'http://localhost:3000/selector',
      ],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        throttlingMethod: 'simulate',
        throttling: {
          cpuSlowdownMultiplier: 4,
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
        },
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
        ],
      },
    },
    assert: {
      assertions: {
        'categories:performance': [
          'error',
          { minScore: 0.85, aggregationMethod: 'optimistic' },
        ],
        'categories:accessibility': [
          'error',
          { minScore: 0.95, aggregationMethod: 'optimistic' },
        ],
        'categories:best-practices': [
          'error',
          { minScore: 0.9, aggregationMethod: 'optimistic' },
        ],
        'categories:seo': [
          'error',
          { minScore: 0.9, aggregationMethod: 'optimistic' },
        ],
        'largest-contentful-paint': [
          'error',
          { maxNumericValue: 2500, aggregationMethod: 'optimistic' },
        ],
        'cumulative-layout-shift': [
          'error',
          { maxNumericValue: 0.1, aggregationMethod: 'optimistic' },
        ],
        'max-potential-fid': [
          'error',
          { maxNumericValue: 100, aggregationMethod: 'optimistic' },
        ],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

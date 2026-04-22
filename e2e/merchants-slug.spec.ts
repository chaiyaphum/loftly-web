import { test, expect } from '@playwright/test';

/**
 * `/merchants/[slug]` smoke. Staging DB might not have `starbucks`
 * canonicalized yet — and as of 2026-04-22 the Merchant Reverse Lookup
 * feature is flagged OFF on staging (API returns 501
 * `merchants_reverse_lookup_disabled`). Accept any of:
 *   (a) a merchant page render with the ranked-card list,
 *   (b) a Next.js 404 (notFound()) rendered by the global `not-found.tsx`,
 *   (c) a 500 from Next.js when the API rejects with a non-404 error —
 *       this is the staging-feature-flag state the MVP spec lets ride.
 *
 * We assert that Playwright can reach the route and that the HTML is not
 * a runtime crash (the error boundary should still render a heading).
 */

test.describe('/merchants/[slug]', () => {
  test('renders merchant page OR 404/feature-disabled fallback', async ({
    page,
  }) => {
    const response = await page.goto('/merchants/starbucks', {
      waitUntil: 'domcontentloaded',
    });
    const status = response?.status() ?? 0;

    // A heading must always render — whether it's the merchant H1, the
    // not-found page title, or the error-boundary title.
    await expect(page.getByRole('heading').first()).toBeVisible();

    const rankedVisible = await page
      .getByTestId('merchant-ranked-list')
      .isVisible()
      .catch(() => false);

    if (rankedVisible) {
      // Happy path — the merchant is canonicalized and the feature flag is on.
      expect(status).toBe(200);
    } else {
      // Staging-dependent fallbacks: 404 (no canonical row) or 500
      // (feature flagged off → 501 upstream → caught by error boundary).
      expect([200, 404, 500]).toContain(status);
    }
  });
});

import { test, expect } from '@playwright/test';

/**
 * Admin routes must be unreachable without an admin session cookie.
 *
 * `/admin` itself 307s to `/admin/cards` (see `src/app/admin/page.tsx`),
 * and the admin layout then detects the missing session and redirects to
 * `/onboarding?next=/admin/cards`. We only assert the final landing URL
 * is the onboarding page — the intermediate hop is an implementation
 * detail.
 */
test.describe('Admin guard', () => {
  test('anonymous /admin visit redirects to onboarding', async ({ page }) => {
    await page.goto('/admin');

    // Wait for redirect chain to settle.
    await page.waitForLoadState('networkidle');

    const finalUrl = page.url();
    expect(finalUrl, `expected /onboarding redirect, got ${finalUrl}`).toMatch(
      /\/onboarding(\?|$)/,
    );

    // Onboarding page must actually render (not a 5xx loop).
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
});

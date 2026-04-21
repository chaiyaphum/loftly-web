import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * Anonymous smoke suite covering the 3 critical public paths identified in
 * `docs/ROADMAP.md` Phase 1:
 *
 *   1. Landing (`/`)          — Thai H1 + primary CTA
 *   2. Card index (`/cards`)  — list renders, no console errors
 *   3. Selector (`/selector`) — minimum happy-path submit
 *
 * Selectors prefer role-based queries or `data-testid` — we deliberately
 * avoid matching copy that may be edited by the content team. Thai copy is
 * only asserted where the page's meaning depends on the word itself
 * (e.g. the "ยกระดับ" hero line is part of the brand voice).
 *
 * All tests are anonymous — do not assume a session. Staging DB may be
 * empty; assertions accept either data OR empty-state where applicable.
 */

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}

test.describe('Landing page', () => {
  test('renders Thai H1, title, and primary CTA', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Loftly/i);

    // Hero H1 must contain the canonical Thai "ยกระดับ" verb — this is
    // part of the brand voice and changing it requires a Decision log entry.
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('ยกระดับ');

    // Primary CTA is a Next <Link asChild> styled as a Button — the
    // landing hero wires it to `/selector`.
    const cta = page.getByRole('link', { name: /ค้นหาบัตรที่ใช่/ });
    await expect(cta.first()).toBeVisible();
  });
});

test.describe('Cards index', () => {
  test('lists cards OR renders empty-state without console errors', async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    const response = await page.goto('/cards');
    expect(response?.status(), 'cards index should not 5xx').toBeLessThan(500);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Staging DB may be empty. Accept either at least one card tile
    // (data-testid="card-result-<id>") OR the friendly empty-state copy.
    const tiles = page.locator('[data-testid^="card-result-"]');
    const emptyState = page.getByText(/ยังไม่มี|No cards/i);

    const tileCount = await tiles.count();
    if (tileCount === 0) {
      await expect(emptyState.first()).toBeVisible();
    } else {
      expect(tileCount).toBeGreaterThan(0);
    }

    // No client-side console errors — third-party / analytics noise is
    // filtered so we only surface app-level bugs.
    const appErrors = consoleErrors.filter(
      (msg) =>
        !/posthog|sentry|favicon|net::ERR_BLOCKED_BY_CLIENT/i.test(msg),
    );
    expect(appErrors, `unexpected console errors: ${appErrors.join('\n')}`).toHaveLength(0);
  });
});

test.describe('Selector form', () => {
  test('accepts minimum input and lands on results OR graceful fallback', async ({
    page,
  }) => {
    await page.goto('/selector');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Monthly spend — Input has id="monthly-spend".
    const spendInput = page.locator('#monthly-spend');
    await expect(spendInput).toBeVisible();
    await spendInput.fill('50000');

    // Goal radio — pick "miles" (the default on the page, but we set it
    // explicitly so the test is robust if the default changes).
    const milesRadio = page
      .getByRole('radio', { name: /ไมล์|miles/i })
      .first();
    if (await milesRadio.count().then((n) => n > 0)) {
      await milesRadio.check({ force: true }).catch(() => {
        // Radio implementations vary; fall back to click.
        return milesRadio.click();
      });
    }

    // Category sliders default to a reasonable split — no need to drag
    // them in the smoke test. The submit button is the only primary CTA.
    const submit = page.getByRole('button', { name: /ค้นหา|Submit|คำนวณ/i });
    await expect(submit).toBeVisible();
    await submit.click();

    // Accept either:
    //   a) navigation to `/selector/results/<id>` (happy path), OR
    //   b) a visible submit-error banner (role="alert") when the API
    //      rejects the call — but never a 5xx crash page.
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const reachedResults = /\/selector\/results\//.test(url);
    const errorBanner = page.getByRole('alert');
    const errorVisible =
      (await errorBanner.count()) > 0 && (await errorBanner.first().isVisible());

    expect(
      reachedResults || errorVisible,
      `expected /selector/results/* or a visible alert, got ${url}`,
    ).toBe(true);

    // Defensive: the page must not be a Next.js error overlay / 5xx.
    await expect(page.getByText(/500|Internal Server Error/i)).toHaveCount(0);
  });
});

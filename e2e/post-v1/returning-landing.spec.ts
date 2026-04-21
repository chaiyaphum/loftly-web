import { test, expect } from '@playwright/test';

/**
 * POST_V1 §3 — Returning-user landing page.
 *
 * Four variants:
 *   1. Fresh       — no cookie → default v1 hero ("ยกระดับทุกแต้ม…").
 *   2. Personalized — recognition cookie present + valid session →
 *                     welcome-back hero ("ยินดีต้อนรับกลับ…").
 *   3. Expired     — cookie present + session expired (24h TTL hit) →
 *                     default hero + "คุณเคยใช้ Selector" banner.
 *   4. Crawler     — Googlebot UA → SSR HTML MUST contain only default
 *                     hero, never personalized. Anti-cloaking (POST_V1.md
 *                     §3 AC-4).
 *
 * The personalized / expired variants hydrate CLIENT-SIDE via
 * `useEffect` → `readSelectorSessionCookie()` → `GET /v1/selector/recent`.
 * SSR always renders the default hero. Tests 2 & 3 need a real or stubbed
 * `/v1/selector/recent` response; because we cannot reach Redis from
 * Playwright we use `page.route()` to intercept and return canned bodies.
 *
 * Tests 2 & 3 are `.skip()`'d pending the PR-11 LandingHero variant client
 * island landing in `main` — the current `LandingHero.tsx` in PR-11 adds
 * `data-testid="landing-hero"` with a `data-variant` attribute we use to
 * distinguish default vs personalized. Until PR-11 lands, the cookie +
 * fetch stubs have nothing to render into.
 */

const COOKIE_NAME = 'loftly_selector_session';

/**
 * Build the cookie body the PR-7 writer sets on `/selector/results/*` mount.
 * Shape: `{session_id, last_seen_at}` URL-encoded JSON.
 */
function buildRecognitionCookie(sessionId: string, lastSeenAt?: string): {
  name: string;
  value: string;
  domain: string;
  path: string;
} {
  const payload = {
    session_id: sessionId,
    last_seen_at: lastSeenAt ?? new Date().toISOString(),
  };
  const baseURL = process.env.E2E_BASE_URL ??
    'https://loftly-web-staging-xymb5.ondigitalocean.app';
  const host = new URL(baseURL).hostname;
  return {
    name: COOKIE_NAME,
    value: encodeURIComponent(JSON.stringify(payload)),
    domain: host,
    path: '/',
  };
}

test.describe('POST_V1 §3 returning-user landing', () => {
  test('fresh — incognito visit renders default v1 hero', async ({
    browser,
  }) => {
    // Force an isolated context (no cookies carried over) so we are
    // guaranteed to be a "fresh" user even when run alongside other specs.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page).toHaveTitle(/Loftly/i);

      // Default hero — brand voice requires "ยกระดับ" in H1.
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('ยกระดับ');

      // Anti-regression: welcome-back copy MUST NOT appear without cookie.
      const welcomeBack = page.getByText(/ยินดีต้อนรับกลับ/);
      await expect(welcomeBack).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  // TODO(founder): remove `.skip()` once PR-11 LandingHero personalized
  // variant is merged on main. Test relies on the client island mounting
  // a personalized H1 containing "ยินดีต้อนรับกลับ".
  test.skip('personalized — valid session cookie renders welcome-back hero', async ({
    browser,
  }) => {
    const sessionId = '00000000-0000-4000-8000-e2ereturning001';
    const context = await browser.newContext();
    await context.addCookies([buildRecognitionCookie(sessionId)]);
    const page = await context.newPage();

    // Stub `/v1/selector/recent` to return a live personalized body. Route
    // matching is URL-prefix based so both absolute and rewritten paths
    // are intercepted.
    await page.route(/\/v1\/selector\/recent/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_id: sessionId,
          expired: false,
          card_name: 'KTC Royal Orchid Plus Visa Platinum',
          last_seen_at: new Date().toISOString(),
        }),
      });
    });

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Client island has hydrated; personalized H1 MUST be present.
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('ยินดีต้อนรับกลับ');
    } finally {
      await context.close();
    }
  });

  // TODO(founder): remove `.skip()` once PR-11 expired-banner variant
  // lands (PR-12a). Test relies on "คุณเคยใช้ Selector" banner copy.
  test.skip('expired — stubbed /v1/selector/recent returns expired, banner shows', async ({
    browser,
  }) => {
    const sessionId = '00000000-0000-4000-8000-e2ereturning002';
    const context = await browser.newContext();
    await context.addCookies([
      buildRecognitionCookie(
        sessionId,
        // 25h ago — older than the 24h Redis TTL.
        new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      ),
    ]);
    const page = await context.newPage();

    await page.route(/\/v1\/selector\/recent/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session_id: sessionId,
          expired: true,
        }),
      });
    });

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Default hero still present — expired path does NOT swap the H1.
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toContainText('ยกระดับ');

      // Expired banner — "คุณเคยใช้ Selector" per POST_V1.md §3.
      const banner = page.getByText(/คุณเคยใช้ Selector/);
      await expect(banner.first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('crawler safety — Googlebot UA sees only default hero in SSR HTML', async ({
    browser,
  }) => {
    // Anti-cloaking assertion (POST_V1.md §3 AC-4). We MUST serve the
    // same default hero to crawlers regardless of cookie state so Google
    // does not penalize the page for cloaking.
    const sessionId = '00000000-0000-4000-8000-e2ereturning003';
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      extraHTTPHeaders: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    await context.addCookies([buildRecognitionCookie(sessionId)]);
    const page = await context.newPage();

    // Block ALL calls to /v1/selector/recent so even if hydration starts
    // it cannot complete — guarantees any "personalized" H1 we see would
    // be from SSR, which is the bug we're guarding against.
    await page.route(/\/v1\/selector\/recent/, (route) => route.abort());

    try {
      // Wait for DOMContentLoaded so we capture SSR HTML BEFORE React
      // hydrates. `page.content()` reads the current DOM which may have
      // been mutated by hydration, so we use `document.documentElement
      // .outerHTML` inside a `domcontentloaded` handler.
      const ssrHtmlPromise = (async () => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        return page.evaluate(() => document.documentElement.outerHTML);
      })();

      const ssrHtml = await ssrHtmlPromise;

      // Assertion — default hero text is present, personalized is NOT.
      expect(ssrHtml, 'SSR HTML should contain default "ยกระดับ" hero').toContain(
        'ยกระดับ',
      );
      expect(
        ssrHtml,
        'SSR HTML MUST NOT contain "ยินดีต้อนรับกลับ" — that would be cloaking',
      ).not.toContain('ยินดีต้อนรับกลับ');
    } finally {
      await context.close();
    }
  });
});

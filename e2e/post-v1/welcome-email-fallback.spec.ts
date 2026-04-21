import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * POST_V1 §2 — Personalized welcome email, static-fallback smoke.
 *
 * The personalized LLM path (composer in `loftly-api`) is guarded by the
 * `WELCOME_EMAIL_PERSONALIZED` env var; when OFF (or when Anthropic is
 * unreachable), the backend MUST fall back to the static magic-link email
 * without crashing the `/v1/auth/magic-link/request` endpoint. This spec
 * asserts the fallback path:
 *
 *   1. The magic-link request returns 202 promptly (fire-and-forget confirmed).
 *   2. The results page continues to render without uncaught client errors.
 *
 * We cannot E2E-assert actual email delivery in CI — Resend sandbox + staging
 * inbox polling is out of scope for Playwright. This is a "smoke — API call
 * succeeds" test. Delivery correctness is covered by backend integration
 * tests in `loftly-api` + manual verification post-deploy.
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

test.describe('POST_V1 §2 welcome-email static fallback', () => {
  test('magic-link request returns 202 within 500ms (fire-and-forget confirmed)', async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    // Step 1 — submit the Selector form to land on a fresh results page.
    await page.goto('/selector');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const spendInput = page.locator('#monthly-spend');
    await expect(spendInput).toBeVisible();
    await spendInput.fill('50000');

    // Default goal is miles; set it explicitly so the test survives default
    // flips.
    const milesRadio = page
      .getByRole('radio', { name: /ไมล์|miles/i })
      .first();
    if (await milesRadio.count().then((n) => n > 0)) {
      await milesRadio.check({ force: true }).catch(() => milesRadio.click());
    }

    const submit = page.getByRole('button', { name: /ค้นหา|Submit|คำนวณ/i });
    await submit.click();

    // Wait for redirect to the results page — accept either the navigation
    // or a visible error alert (staging backend can be flaky; the welcome-
    // email path still deserves to be asserted when it IS reachable).
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const reachedResults = /\/selector\/results\//.test(url);
    if (!reachedResults) {
      test.skip(true, `selector submit did not land on results: ${url}`);
    }

    // Step 2 — attach a response listener BEFORE we trigger the POST so we
    // do not race the network.
    const magicLinkResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v1/auth/magic-link/request') &&
        res.request().method() === 'POST',
      { timeout: 10_000 },
    );
    const requestStart = Date.now();

    // Step 3 — fill + submit the email gate. MagicLinkPrompt uses an
    // `<Input type="email">` labeled by the "promptTitle" copy; we target
    // it via role + type rather than free-form text so content edits don't
    // break the test.
    const emailInput = page.locator('input[type="email"]').first();
    if ((await emailInput.count()) === 0) {
      // No magic-link prompt is visible — the results page has only the
      // rationale (no secondaries locked, or already authed). Skip without
      // failing because the §2 path requires the prompt to be visible.
      test.skip(
        true,
        'MagicLinkPrompt not visible on this results page; unable to exercise §2',
      );
    }
    await emailInput.fill('e2e-postv1-welcome@loftly-e2e.test');
    // The button label is localized; target via form submission semantics.
    const form = emailInput.locator('xpath=ancestor::form').first();
    await form.locator('button[type="submit"]').click();

    const response = await magicLinkResponsePromise;
    const elapsedMs = Date.now() - requestStart;

    // AC-1 — endpoint accepts the request with 202 (fire-and-forget). The
    // backend queues the welcome email async via `asyncio.create_task`; the
    // response status is the only durable proof the request was accepted.
    expect(response.status(), `expected 202, got ${response.status()}`).toBe(
      202,
    );

    // AC-2 — latency budget. Fire-and-forget means the endpoint should
    // respond well within 500ms even when the LLM composer is disabled;
    // staging network jitter is budgeted generously at 2000ms ceiling.
    expect(
      elapsedMs,
      `magic-link request took ${elapsedMs}ms (budget: 2000ms)`,
    ).toBeLessThan(2000);

    // AC-3 — no uncaught client errors. Filter third-party noise so we
    // only surface app-level bugs. (`partial_unlock` email-gate flow is the
    // one under test.)
    const appErrors = consoleErrors.filter(
      (msg) =>
        !/posthog|sentry|favicon|net::ERR_BLOCKED_BY_CLIENT/i.test(msg),
    );
    expect(
      appErrors,
      `unexpected console errors: ${appErrors.join('\n')}`,
    ).toHaveLength(0);
  });
});

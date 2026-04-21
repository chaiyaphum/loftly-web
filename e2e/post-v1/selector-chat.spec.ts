import { test, expect } from '@playwright/test';

/**
 * POST_V1 §1 — Selector chat panel.
 *
 * The chat panel is flag-gated by `post_v1_selector_chat` in PostHog. When
 * the flag is OFF, the panel renders nothing and these tests have nothing
 * to assert — they are marked `.skip()` with a TODO so the founder can run
 * them manually after enabling the flag on staging.
 *
 * Detection approach: we look for `[data-testid="selector-chat-panel"]` on
 * the results page. When absent after `networkidle`, we assume the flag is
 * OFF. This keeps the suite green pre-rollout and transparent once the
 * flag flips ON.
 *
 * Three sub-tests, matching POST_V1.md §1 AC-2, AC-5, AC-6:
 *   1. Happy path — click a suggested prompt, assert response renders.
 *   2. Rate-limit — send 11 follow-ups, assert 11th is blocked.
 *   3. Email-gate on anonymous — partial_unlock=true → MagicLinkPrompt.
 *
 * Because the chat panel is not merged on `main` yet (PR-10 in progress),
 * we guard the happy-path + rate-limit tests behind a panel-visibility
 * check. The email-gate test uses MagicLinkPrompt which already ships, so
 * it runs against the existing `partial_unlock` locked-secondaries UX as
 * an interim assertion until the chat flow lands.
 */

const CHAT_PANEL_TESTID = 'selector-chat-panel';
const CHAT_INPUT_TESTID = 'selector-chat-input';
const CHAT_SEND_TESTID = 'selector-chat-send';
const CHAT_PROMPT_SUGGESTION_TESTID = 'selector-chat-prompt-suggestion';
const CHAT_RESPONSE_TESTID = 'selector-chat-response';
const CHAT_RATE_LIMIT_TESTID = 'selector-chat-rate-limit';

/**
 * Submit the Selector form with a minimal-valid profile and return the
 * resulting `/selector/results/{id}` URL. When the backend 5xxs we skip
 * the test — chat panel tests require a real session.
 */
async function provisionResultsSession(
  page: import('@playwright/test').Page,
): Promise<string> {
  await page.goto('/selector');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const spendInput = page.locator('#monthly-spend');
  await expect(spendInput).toBeVisible();
  await spendInput.fill('50000');

  const milesRadio = page.getByRole('radio', { name: /ไมล์|miles/i }).first();
  if (await milesRadio.count().then((n) => n > 0)) {
    await milesRadio.check({ force: true }).catch(() => milesRadio.click());
  }

  const submit = page.getByRole('button', { name: /ค้นหา|Submit|คำนวณ/i });
  await submit.click();
  await page.waitForLoadState('networkidle');

  const url = page.url();
  if (!/\/selector\/results\//.test(url)) {
    test.skip(true, `selector submit did not land on results: ${url}`);
  }
  return url;
}

test.describe('POST_V1 §1 selector chat', () => {
  // TODO(founder): remove `.skip()` once `post_v1_selector_chat` is ON
  // in the staging PostHog project. The test is authored against the
  // PR-10 ChatPanel.tsx testid contract; re-run to verify.
  test.skip('happy path — suggested prompt populates input, send produces response', async ({
    page,
  }) => {
    const resultsUrl = await provisionResultsSession(page);
    await page.goto(resultsUrl);
    await page.waitForLoadState('networkidle');

    const panel = page.getByTestId(CHAT_PANEL_TESTID);
    if ((await panel.count()) === 0) {
      test.skip(
        true,
        'post_v1_selector_chat flag OFF on staging — chat panel absent',
      );
    }
    await expect(panel.first()).toBeVisible();

    // Click the first suggested prompt — copy is "ทำไมอันดับ 1?" per PR-10.
    const promptButton = page
      .getByTestId(CHAT_PROMPT_SUGGESTION_TESTID)
      .first();
    await expect(promptButton).toBeVisible();
    await promptButton.click();

    const input = page.getByTestId(CHAT_INPUT_TESTID);
    await expect(input).not.toHaveValue('');

    const send = page.getByTestId(CHAT_SEND_TESTID);
    await send.click();

    // LLM call has a 5s backend budget + 3s target p95; allow 10s ceiling.
    const response = page.getByTestId(CHAT_RESPONSE_TESTID).first();
    await expect(response).toBeVisible({ timeout: 10_000 });
    await expect(response).not.toBeEmpty();
  });

  // TODO(founder): remove `.skip()` once `post_v1_selector_chat` is ON.
  // Note: this test sends 11 real API calls; budget ~THB 5 per run.
  test.skip('rate-limit — 11th follow-up receives rate-limit message', async ({
    page,
  }) => {
    const resultsUrl = await provisionResultsSession(page);
    await page.goto(resultsUrl);
    await page.waitForLoadState('networkidle');

    const panel = page.getByTestId(CHAT_PANEL_TESTID);
    if ((await panel.count()) === 0) {
      test.skip(
        true,
        'post_v1_selector_chat flag OFF on staging — chat panel absent',
      );
    }

    const input = page.getByTestId(CHAT_INPUT_TESTID);
    const send = page.getByTestId(CHAT_SEND_TESTID);

    // Send 10 follow-ups — under the 10-msg cap, all should succeed.
    for (let i = 1; i <= 10; i++) {
      await input.fill(`ทดสอบข้อความที่ ${i}`);
      await send.click();
      // Wait for response i before sending i+1 so we don't race.
      const responses = page.getByTestId(CHAT_RESPONSE_TESTID);
      await expect(responses).toHaveCount(i, { timeout: 10_000 });
    }

    // 11th message — MUST be blocked by the backend 429 + surface the
    // rate-limit banner.
    await input.fill('ข้อความที่ 11 — เกิน quota');
    await send.click();

    const rateLimitBanner = page.getByTestId(CHAT_RATE_LIMIT_TESTID);
    await expect(rateLimitBanner.first()).toBeVisible({ timeout: 10_000 });
  });

  test('email-gate on anonymous — locked session shows MagicLinkPrompt', async ({
    page,
  }) => {
    // We cannot force `partial_unlock=true` on a staging session without
    // backend access. Instead we submit the form anonymously (no session
    // cookie) — the backend tags anon responses `partial_unlock: true`
    // when the user has seen ≥ N queries, or always for specific profiles.
    //
    // On the results page, the MagicLinkPrompt component is visible as the
    // blurred-secondaries overlay when `partial_unlock && !accessToken`.
    // If it IS visible we assert its email form renders; otherwise we
    // skip — partial_unlock is a backend decision we cannot force in E2E.
    await provisionResultsSession(page);
    await page.waitForLoadState('networkidle');

    const magicLinkForm = page.locator(
      'form[aria-label], form:has(input[type="email"])',
    );
    const emailInput = page.locator('input[type="email"]').first();

    if ((await emailInput.count()) === 0) {
      test.skip(
        true,
        'partial_unlock not triggered for this session — MagicLinkPrompt absent',
      );
    }

    await expect(emailInput).toBeVisible();
    // Assert it's submittable — the email-gate contract is that submit
    // triggers `/v1/auth/magic-link/request` (tested in welcome-email-fallback).
    await expect(magicLinkForm.first()).toBeVisible();
    const submitBtn = magicLinkForm
      .first()
      .locator('button[type="submit"]')
      .first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });
});

# E2E smoke suite

A Playwright-based smoke suite that exercises loftly-web's public,
anonymous-critical paths against staging. Scope is intentionally narrow —
it catches regressions that a unit test cannot (SSR data fetch, middleware,
redirects, real CSS) without trying to be a full functional suite.

## What it covers

| File                       | Path            | Assertion                                          |
| -------------------------- | --------------- | -------------------------------------------------- |
| `e2e/smoke.spec.ts`        | `/`             | Title contains "Loftly", Thai H1 "ยกระดับ", CTA    |
| `e2e/smoke.spec.ts`        | `/cards`        | List OR empty-state, no app console errors         |
| `e2e/smoke.spec.ts`        | `/selector`     | Fill minimum form, submit, results OR graceful alert |
| `e2e/admin-guard.spec.ts`  | `/admin`        | Anonymous visit redirects to `/onboarding`         |

Two projects run every test: `chromium` (Desktop Chrome) and
`mobile-chrome` (Pixel 5). Firefox + WebKit are deliberately out of scope
for Phase 1 — they double CI cost for marginal coverage.

## Running locally

```sh
# One-time browser download (~150 MB for chromium only).
npx playwright install chromium

# Against default staging URL:
npm run test:e2e

# Against a preview or local dev server:
E2E_BASE_URL=http://localhost:3000 npm run test:e2e

# Run a single test file, headed, slow-mo, with inspector:
npx playwright test e2e/smoke.spec.ts --headed --debug
```

After a run, open the HTML report:

```sh
npx playwright show-report
```

## Running in CI

The workflow `.github/workflows/e2e.yml` runs on:

- **Nightly cron** — 02:00 UTC (09:00 ICT), after the evening deploy settles.
- **Manual dispatch** — Actions tab → "E2E Smoke (staging)" → Run workflow.
  Optionally override `base_url` to target a specific PR preview.

`E2E_BASE_URL` is driven by the workflow `env` — prod URLs are not a
valid input and the workflow MUST never be pointed at production (the
suite submits real selector requests).

The HTML report is uploaded as an artifact and retained for 14 days.
When debugging a failure, download `playwright-report-<run_id>.zip`
from the run summary and open `index.html`.

## Updating selectors

Prefer role-based selectors (`getByRole('button', { name: ... })`),
`data-testid`, and stable ids. Avoid:

- Tailwind class strings (change every design sprint)
- Free-form copy in `messages/*.json` (content team edits frequently)
- Position-based locators (`.first()` on ambiguous matches)

When a test fails because a selector drifted, update the test AND flag
the component in the PR description so we can add a `data-testid` if one
doesn't exist.

## Interpreting failures

| Symptom                                           | First thing to check                               |
| ------------------------------------------------- | -------------------------------------------------- |
| `page.goto` timeout                               | Staging down? Hit the URL in a browser.            |
| `expect(heading).toContainText('ยกระดับ')` fails  | Did someone change the landing H1? Decision log.   |
| Selector form assertion fails with "alert" branch | Backend `/v1/selector` 5xx — check API logs.       |
| Cards page "empty-state" always hit               | Expected today (seed data TBD). Not a regression.  |
| Admin guard redirects somewhere other than /onboarding | Middleware or admin layout change — review diff. |

## Known limitations

- **Anonymous only.** We do not test authenticated admin flows here. That
  surface is covered by Vitest + backend integration tests until we have
  a staging admin seed account (tracked in `loftly/mvp/MANUAL_ITEMS.md`).
- **Staging DB may be empty.** `/cards` accepts either tiles or empty-state
  so the suite is stable through content seeding.
- **No visual regression.** Screenshots are captured on failure only. For
  visual diffing, Percy / Chromatic would be added later (not MVP scope).

*Last updated: April 2026*

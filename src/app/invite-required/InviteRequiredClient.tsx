'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { capture } from '@/lib/posthog';

/**
 * Client-side UI for the invite gate (`/invite-required`).
 *
 * Renders three pathways for a gated visitor:
 *   1. "I have a code" — the original form (POSTs to `/api/invite`, which sets
 *      the cookie and 303-redirects on success). Kept first, since anyone
 *      arriving from an onboarding email will have a code in hand.
 *   2. "Join the waitlist" — email input that POSTs to
 *      `/api/invite/waitlist-join`, a thin proxy to `POST /v1/waitlist` with
 *      `source=invite_gate`. Mirrors the pricing-page flow (created/exists
 *      map to success; rate_limited/invalid/error render the matching copy).
 *   3. "Follow along" — static links to Pantip AMA, LINE OA, and X/Twitter so
 *      the visitor can track launch activity without needing an email.
 *
 * PostHog events:
 *   - `invite_required_viewed` fires once on mount (before any interaction).
 *   - `invite_required_waitlist_joined` fires when the waitlist POST resolves
 *     with a success status (created or exists), carrying the normalised
 *     status string for funnel breakdown.
 *
 * The submit button for the waitlist is disabled while in flight to avoid
 * double-submits triggering the 10/5min/IP upstream rate-limit.
 */

type WaitlistResultStatus =
  | 'created'
  | 'exists'
  | 'rate_limited'
  | 'invalid'
  | 'error';

type WaitlistState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done'; status: WaitlistResultStatus; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUCCESS_STATUSES: ReadonlySet<WaitlistResultStatus> = new Set([
  'created',
  'exists',
]);

// Placeholder launch-follow links — founder fills these in post-AMA / when the
// LINE OA is registered. The page renders them as-is so QA can click through
// even before real URLs land.
const LAUNCH_LINKS = {
  pantip: 'https://pantip.com/tag/Loftly',
  line: 'https://line.me/R/ti/p/@loftly',
  twitter: 'https://twitter.com/loftly_th',
} as const;

function statusFromResponse(
  httpStatus: number,
  body: unknown,
): WaitlistResultStatus {
  const fromBody =
    body &&
    typeof body === 'object' &&
    'status' in body &&
    typeof (body as { status: unknown }).status === 'string'
      ? ((body as { status: string }).status as WaitlistResultStatus)
      : undefined;
  if (
    fromBody === 'created' ||
    fromBody === 'exists' ||
    fromBody === 'rate_limited' ||
    fromBody === 'invalid' ||
    fromBody === 'error'
  ) {
    return fromBody;
  }
  // Body missing/unparseable — fall back to the HTTP status.
  if (httpStatus === 201) return 'created';
  if (httpStatus === 200 || httpStatus === 204) return 'exists';
  if (httpStatus === 422) return 'invalid';
  if (httpStatus === 429) return 'rate_limited';
  return 'error';
}

export function InviteRequiredClient({ hasError }: { hasError: boolean }) {
  const t = useTranslations('invite');
  const tr = useTranslations('invite.required');

  React.useEffect(() => {
    void capture('invite_required_viewed');
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col px-6 py-12">
      <h1 className="text-3xl font-semibold text-loftly-ink">
        {tr('page.title')}
      </h1>
      <p className="mt-3 text-sm text-loftly-ink-muted">{tr('page.subtitle')}</p>

      {/* 1. Have a code */}
      <section
        className="mt-10 border-t border-loftly-divider pt-8"
        aria-labelledby="invite-have-code-heading"
        data-testid="invite-section-have-code"
      >
        <h2
          id="invite-have-code-heading"
          className="text-xl font-semibold text-loftly-ink"
        >
          {tr('section.haveCode.title')}
        </h2>

        <form
          method="post"
          action="/api/invite"
          className="mt-4 space-y-4"
          aria-describedby={hasError ? 'invite-error' : undefined}
        >
          <div className="space-y-2">
            <label
              htmlFor="invite-code"
              className="block text-sm font-medium text-loftly-ink"
            >
              {t('codeLabel')}
            </label>
            <Input
              id="invite-code"
              name="code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              minLength={4}
              maxLength={64}
              aria-invalid={hasError || undefined}
              aria-errormessage={hasError ? 'invite-error' : undefined}
              placeholder={t('codePlaceholder')}
            />
            <p className="text-xs text-loftly-ink-muted">{t('codeHint')}</p>
          </div>

          {hasError ? (
            <p
              id="invite-error"
              role="alert"
              className="rounded-md border border-red-200 bg-loftly-danger/10 px-3 py-2 text-sm text-loftly-danger"
            >
              {t('errorInvalid')}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full">
            {tr('section.haveCode.submit')}
          </Button>
        </form>
      </section>

      {/* 2. Join the waitlist */}
      <section
        className="mt-10 border-t border-loftly-divider pt-8"
        aria-labelledby="invite-waitlist-heading"
        data-testid="invite-section-waitlist"
      >
        <h2
          id="invite-waitlist-heading"
          className="text-xl font-semibold text-loftly-ink"
        >
          {tr('section.joinWaitlist.title')}
        </h2>
        <p className="mt-2 text-sm text-loftly-ink-muted">
          {tr('section.joinWaitlist.body')}
        </p>
        <WaitlistForm />
      </section>

      {/* 3. Follow the launch */}
      <section
        className="mt-10 border-t border-loftly-divider pt-8"
        aria-labelledby="invite-follow-heading"
        data-testid="invite-section-follow"
      >
        <h2
          id="invite-follow-heading"
          className="text-xl font-semibold text-loftly-ink"
        >
          {tr('section.followLaunch.title')}
        </h2>
        <ul className="mt-4 flex flex-col gap-3 text-sm">
          <li>
            <a
              href={LAUNCH_LINKS.pantip}
              target="_blank"
              rel="noopener noreferrer"
              className="text-loftly-teal underline underline-offset-2 hover:text-loftly-teal/80"
              data-testid="invite-follow-pantip"
            >
              {tr('section.followLaunch.pantip')}
            </a>
          </li>
          <li>
            <a
              href={LAUNCH_LINKS.line}
              target="_blank"
              rel="noopener noreferrer"
              className="text-loftly-teal underline underline-offset-2 hover:text-loftly-teal/80"
              data-testid="invite-follow-line"
            >
              {tr('section.followLaunch.line')}
            </a>
          </li>
          <li>
            <a
              href={LAUNCH_LINKS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-loftly-teal underline underline-offset-2 hover:text-loftly-teal/80"
              data-testid="invite-follow-twitter"
            >
              {tr('section.followLaunch.twitter')}
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}

function WaitlistForm() {
  const t = useTranslations('invite.required.section.joinWaitlist');
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<WaitlistState>({ kind: 'idle' });

  const onSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (state.kind === 'submitting') return;

      const trimmed = email.trim();
      if (!EMAIL_RE.test(trimmed)) {
        setState({ kind: 'done', status: 'invalid', email: trimmed });
        return;
      }
      setState({ kind: 'submitting' });

      let res: Response;
      try {
        res = await fetch('/api/invite/waitlist-join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        });
      } catch {
        setState({ kind: 'done', status: 'error', email: trimmed });
        return;
      }

      let body: unknown = undefined;
      try {
        body = await res.json();
      } catch {
        // Empty / non-JSON body — fall back to HTTP status mapping.
      }
      const status = statusFromResponse(res.status, body);
      setState({ kind: 'done', status, email: trimmed });

      if (SUCCESS_STATUSES.has(status)) {
        void capture('invite_required_waitlist_joined', {
          status,
        });
      }
    },
    [email, state.kind],
  );

  if (state.kind === 'done' && SUCCESS_STATUSES.has(state.status)) {
    return (
      <p
        role="status"
        className="mt-4 rounded-md border border-emerald-200 bg-loftly-teal-soft p-3 text-sm text-loftly-teal"
        data-testid="invite-waitlist-success"
        data-status={state.status}
      >
        {t('status.created', { email: state.email })}
      </p>
    );
  }

  const errorMessage =
    state.kind === 'done'
      ? t(`status.${state.status}` as const, { email: state.email })
      : null;

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2">
      <label
        htmlFor="invite-waitlist-email"
        className="block text-sm font-medium text-loftly-ink"
      >
        {t('emailLabel')}
      </label>
      <Input
        id="invite-waitlist-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        required
        data-testid="invite-waitlist-email"
        disabled={state.kind === 'submitting'}
      />
      <Button
        type="submit"
        disabled={state.kind === 'submitting'}
        data-testid="invite-waitlist-submit"
        aria-busy={state.kind === 'submitting' ? true : undefined}
      >
        {t('submit')}
      </Button>
      {errorMessage && (
        <p
          role="alert"
          className="text-xs text-red-600"
          data-testid="invite-waitlist-error"
          data-status={state.kind === 'done' ? state.status : undefined}
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

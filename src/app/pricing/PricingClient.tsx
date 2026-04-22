'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeatureFlag } from '@/lib/feature-flags';
import { capture } from '@/lib/posthog';

/**
 * Client-side pricing UI.
 *
 * Reads the `pricing_tier_test` flag (control | variant_a_349 | variant_b_199)
 * from the already-shipped `useFeatureFlag` helper. While the flag resolves
 * (SSR, no PostHog key, consent denied, etc.) we render `control` so the UI
 * stays identical to the baseline, per the feature-flags contract.
 *
 * Waitlist submission:
 *   - POSTs to `/pricing/waitlist` (local route handler) which proxies the
 *     real `POST /v1/waitlist` endpoint on loftly-api. The route returns a
 *     `{ status: 'created' | 'exists' | 'rate_limited' | 'invalid' | 'error' }`
 *     body we branch on — the HTTP status is still forwarded but we rely on
 *     the string so a missing body (e.g. an unexpected 502) still maps onto
 *     the `error` branch.
 *   - The submit button is disabled while the request is in flight so a
 *     double-click doesn't push the caller over the 10/5min/IP rate-limit.
 */

type PricingVariant = 'control' | 'variant_a_349' | 'variant_b_199';

const VARIANTS = {
  variant_a_349: {
    monthly: 349,
    yearly: 3490,
  },
  variant_b_199: {
    monthly: 199,
    yearly: 1990,
  },
} as const;

type PremiumVariant = Exclude<PricingVariant, 'control'>;

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

export function PricingClient() {
  const variant = useFeatureFlag<PricingVariant>(
    'pricing_tier_test',
    'control',
  );

  if (variant === 'control') {
    return <ControlTier />;
  }
  return <PremiumTier variant={variant} />;
}

function ControlTier() {
  const t = useTranslations('pricing');
  return (
    <section
      data-testid="pricing-variant-control"
      className="grid gap-6 sm:grid-cols-1"
    >
      <article className="flex flex-col gap-4 rounded-lg border border-loftly-divider p-6">
        <header className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">{t('free_tier')}</h2>
        </header>
        <p className="text-loftly-ink-muted">{t('free_tier_description')}</p>
        <div>
          <Button asChild size="lg">
            <Link href="/selector">{t('control_cta')}</Link>
          </Button>
        </div>
      </article>
    </section>
  );
}

function PremiumTier({ variant }: { variant: PremiumVariant }) {
  const t = useTranslations('pricing');
  const prices = VARIANTS[variant];
  return (
    <section
      data-testid={`pricing-variant-${variant}`}
      className="grid gap-6 sm:grid-cols-2"
    >
      <article className="flex flex-col gap-4 rounded-lg border border-loftly-divider p-6">
        <header>
          <h2 className="text-2xl font-semibold">{t('free_tier')}</h2>
        </header>
        <p className="text-loftly-ink-muted">{t('free_tier_description')}</p>
        <div>
          <Button asChild variant="outline">
            <Link href="/selector">{t('control_cta')}</Link>
          </Button>
        </div>
      </article>

      <article
        className="flex flex-col gap-4 rounded-lg border-2 border-loftly-baht p-6"
        data-testid="pricing-premium-card"
      >
        <header className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-loftly-baht">
            {t('coming_phase_2')}
          </span>
          <h2 className="text-2xl font-semibold">{t('premium_tier')}</h2>
          <p className="text-xl" data-testid="pricing-premium-monthly">
            {t('premium_monthly', { amount: prices.monthly.toLocaleString() })}
          </p>
          <p className="text-sm text-loftly-ink-muted">
            {t('premium_yearly', { amount: prices.yearly.toLocaleString() })}
          </p>
        </header>

        <ul className="flex flex-col gap-2 text-sm text-loftly-ink">
          <li>• {t('feature_award_finder')}</li>
          <li>• {t('feature_alerts')}</li>
          <li>• {t('feature_unified_balance')}</li>
          <li>• {t('feature_support')}</li>
          <li>• {t('feature_api')}</li>
        </ul>

        <WaitlistForm variant={variant} tier="premium" />
      </article>
    </section>
  );
}

function WaitlistForm({
  variant,
  tier,
}: {
  variant: PremiumVariant;
  tier: 'premium';
}) {
  const t = useTranslations('pricing');
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<WaitlistState>({ kind: 'idle' });

  const onSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Guard against re-entrancy — the button is also `disabled`, but the
      // form can still be submitted by pressing Enter while the fetch is in
      // flight in some browsers.
      if (state.kind === 'submitting') return;

      const trimmed = email.trim();
      if (!EMAIL_RE.test(trimmed)) {
        setState({ kind: 'done', status: 'invalid', email: trimmed });
        return;
      }
      setState({ kind: 'submitting' });

      // Fire the PostHog event first — the test itself is about interest, not
      // about whether the backend stored the row. PostHog will associate the
      // event with the current distinct_id (anon or identified).
      void capture('pricing_waitlist_joined', {
        variant,
        tier,
        monthly_price_thb: VARIANTS[variant].monthly,
        yearly_price_thb: VARIANTS[variant].yearly,
      });

      let res: Response;
      try {
        res = await fetch('/pricing/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, variant, tier }),
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
    },
    [email, variant, tier, state.kind],
  );

  if (state.kind === 'done' && SUCCESS_STATUSES.has(state.status)) {
    const key = `waitlist.status.${state.status}` as const;
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-200 bg-loftly-teal-soft p-3 text-sm text-loftly-teal"
        data-testid="pricing-waitlist-success"
        data-status={state.status}
      >
        {t(key, { email: state.email })}
      </p>
    );
  }

  const errorMessage =
    state.kind === 'done'
      ? t(`waitlist.status.${state.status}` as const, { email: state.email })
      : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('waitlist_placeholder')}
        autoComplete="email"
        required
        data-testid="pricing-waitlist-email"
        disabled={state.kind === 'submitting'}
      />
      <Button
        type="submit"
        disabled={state.kind === 'submitting'}
        data-testid="pricing-waitlist-submit"
        aria-busy={state.kind === 'submitting' ? true : undefined}
      >
        {t('waitlist_cta')}
      </Button>
      {errorMessage && (
        <p
          role="alert"
          className="text-xs text-red-600"
          data-testid="pricing-waitlist-error"
          data-status={state.kind === 'done' ? state.status : undefined}
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

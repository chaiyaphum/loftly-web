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
 *   - POSTs to `/pricing/waitlist` (local route handler). The handler forwards
 *     to `POST /v1/waitlist` if that endpoint exists upstream; otherwise the
 *     handler logs and returns 204. Either way the client emits the PostHog
 *     event `pricing_waitlist_joined` with the variant + tier so ops can
 *     compare interest across variants without a real backend.
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

type WaitlistState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      <article className="flex flex-col gap-4 rounded-lg border border-slate-200 p-6">
        <header className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">{t('free_tier')}</h2>
        </header>
        <p className="text-slate-600">{t('free_tier_description')}</p>
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
      <article className="flex flex-col gap-4 rounded-lg border border-slate-200 p-6">
        <header>
          <h2 className="text-2xl font-semibold">{t('free_tier')}</h2>
        </header>
        <p className="text-slate-600">{t('free_tier_description')}</p>
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
          <p className="text-sm text-slate-500">
            {t('premium_yearly', { amount: prices.yearly.toLocaleString() })}
          </p>
        </header>

        <ul className="flex flex-col gap-2 text-sm text-slate-700">
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
      const trimmed = email.trim();
      if (!EMAIL_RE.test(trimmed)) {
        setState({ kind: 'error', message: t('waitlist_invalid_email') });
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

      try {
        const res = await fetch('/pricing/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, variant, tier }),
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`status ${res.status}`);
        }
        setState({ kind: 'success' });
      } catch {
        setState({ kind: 'error', message: t('waitlist_error') });
      }
    },
    [email, variant, tier, t],
  );

  if (state.kind === 'success') {
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        data-testid="pricing-waitlist-success"
      >
        {t('waitlist_success')}
      </p>
    );
  }

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
      />
      <Button
        type="submit"
        disabled={state.kind === 'submitting'}
        data-testid="pricing-waitlist-submit"
      >
        {t('waitlist_cta')}
      </Button>
      {state.kind === 'error' && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

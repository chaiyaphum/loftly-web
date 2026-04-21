'use client';

/**
 * Landing hero — client island that reads the `landing_hero_cta` PostHog
 * feature flag and renders one of three copy variants.
 *
 * A/B test spec (DEV_PLAN.md §W15):
 *   - control:               current copy — H1 "ยกระดับทุกแต้มบัตรเครดิตของคุณ"
 *   - variant_benefit_led:   H1 "เช็คให้รู้ก่อนรูด" + benefit subtitle + "ลองเลย ▸"
 *   - variant_urgency:       H1 "เก็บค่าคอมแต่ละเดือนก่อนเสีย" + loss-framed subtitle
 *
 * Instrumentation:
 *   - `landing_hero_viewed` fires once on mount with `{ variant }`
 *   - `landing_hero_cta_clicked` fires on CTA click with `{ variant }`
 *   Both events require `analytics` PDPA consent (see `useTrackEvent`).
 *
 * Fallback behavior:
 *   - When PostHog is unreachable, consent is denied, or the flag is
 *     unconfigured, `useFeatureFlag` returns `'control'` — identical to
 *     the shipped landing hero copy, so the UI is always stable.
 *
 * Copy lives in `messages/{th,en}.json` under `landing.hero.<variant>.*`
 * so translators can localize without a code change if needed.
 */

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useFeatureFlag } from '@/lib/feature-flags';
import { useTrackEvent } from '@/lib/analytics';

type Variant = 'control' | 'variant_benefit_led' | 'variant_urgency';

const VARIANTS: readonly Variant[] = [
  'control',
  'variant_benefit_led',
  'variant_urgency',
] as const;

function isVariant(value: string): value is Variant {
  return (VARIANTS as readonly string[]).includes(value);
}

export interface LandingHeroProps {
  /** Copy for the reassurance microtext directly below the CTA. */
  reassurance: string;
  /** Where the CTA button points. Defaults to `/selector`. */
  ctaHref?: string;
}

export function LandingHero({
  reassurance,
  ctaHref = '/selector',
}: LandingHeroProps) {
  const t = useTranslations('landing.hero');
  const track = useTrackEvent();
  const raw = useFeatureFlag<string>('landing_hero_cta', 'control');
  const variant: Variant = isVariant(raw) ? raw : 'control';

  // Fire `landing_hero_viewed` once per mount, and re-fire if the variant
  // upgrades from the default after PostHog resolves (the hook re-renders).
  const lastTrackedVariant = React.useRef<Variant | null>(null);
  React.useEffect(() => {
    if (lastTrackedVariant.current === variant) return;
    lastTrackedVariant.current = variant;
    track('landing_hero_viewed', { variant });
  }, [variant, track]);

  const handleCtaClick = React.useCallback(() => {
    track('landing_hero_cta_clicked', { variant });
  }, [track, variant]);

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="landing-hero"
      data-variant={variant}
    >
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t(`${variant}.h1` as `${Variant}.h1`)}
      </h1>
      <p className="text-lg text-slate-600">
        {t(`${variant}.subtitle` as `${Variant}.subtitle`)}
      </p>
      <div>
        <Button asChild size="lg">
          <Link href={ctaHref} onClick={handleCtaClick}>
            {t(`${variant}.cta` as `${Variant}.cta`)}
          </Link>
        </Button>
      </div>
      <p className="text-sm text-slate-500">{reassurance}</p>
    </section>
  );
}

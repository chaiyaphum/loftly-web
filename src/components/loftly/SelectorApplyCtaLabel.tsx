'use client';

/**
 * Client-side Apply CTA label for the Selector results page.
 *
 * Reads the `selector_cta_copy` PostHog feature flag and renders one of two
 * hard-coded copy variants (control / variant_a). The two strings per locale
 * are defined inline — NOT in messages/*.json — so an experiment rollout
 * doesn't require a translation-file change.
 *
 * A/B test spec (DEV_PLAN.md §W15):
 *   - control:   "สมัครเลย" / "Apply now"
 *   - variant_a: "เช็คคุณสมบัติ" / "Check eligibility"
 *
 * Fallback behavior:
 *   - When PostHog is unreachable or consent is not granted, `useFeatureFlag`
 *     returns "control", keeping the UI stable and the experiment off.
 */

import { useLocale } from 'next-intl';
import { useFeatureFlag } from '@/lib/feature-flags';

type Variant = 'control' | 'variant_a';

const COPY: Record<Variant, { th: string; en: string }> = {
  control: { th: 'สมัครเลย', en: 'Apply now' },
  variant_a: { th: 'เช็คคุณสมบัติ', en: 'Check eligibility' },
};

export function SelectorApplyCtaLabel() {
  const locale = useLocale();
  const raw = useFeatureFlag<string>('selector_cta_copy', 'control');
  const variant: Variant = raw === 'variant_a' ? 'variant_a' : 'control';
  const copy = COPY[variant];
  return <span>{locale === 'en' ? copy.en : copy.th}</span>;
}

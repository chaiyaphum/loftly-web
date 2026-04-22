import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * PromoChip — compact pill showing an active promo on a recommended card.
 *
 * POST_V1 §3 Tier A (2026-04-22) — Promo-Aware Card Selector.
 *
 * Renders as a `<details>` element so the expanded view (T&C + min spend +
 * apply CTA) is native-SSR, keyboard-accessible, and works without JS. An
 * amber/red urgency ring activates when the promo expires within 21/7 days.
 *
 * This is a Server Component (uses `getTranslations`); all interactivity is
 * native HTML (`<details>`/`<summary>`).
 */

export type PromoChipProps = {
  promoId: string;
  merchant: string | null;
  discountValue: string | null;
  discountType: string | null;
  /** ISO date (YYYY-MM-DD). */
  validUntil: string | null;
  minSpend: number | null;
  /** Deep-link target passed to `/apply/promo/[id]` at render time. */
  sourceUrl?: string;
  locale: 'th' | 'en';
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + 'T23:59:59');
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatDiscount(
  type: string | null,
  value: string | null,
): string {
  // Keep the bank's own convention — never paraphrase. If we only have one
  // side, return whatever is available.
  if (value && type) return `${value} ${type}`;
  return value ?? type ?? '';
}

export async function PromoChip({
  promoId,
  merchant,
  discountValue,
  discountType,
  validUntil,
  minSpend,
  sourceUrl,
  locale,
}: PromoChipProps) {
  const t = await getTranslations('selector.promo');
  const days = daysUntil(validUntil);

  // Urgency color: red <= 7d, amber <= 21d. Otherwise neutral "success" green
  // so the chip reads as a positive value signal by default.
  const urgencyVariant: 'success' | 'warn' | 'default' =
    days !== null && days <= 7
      ? 'default' // we'll paint red via className below (Badge has no `danger`).
      : days !== null && days <= 21
        ? 'warn'
        : 'success';

  const urgencyClass =
    days !== null && days <= 7
      ? 'bg-loftly-danger/10 text-loftly-danger ring-1 ring-loftly-danger/30'
      : '';

  const label = t('chip.label', {
    merchant: merchant ?? '',
    value: formatDiscount(discountType, discountValue),
  });

  const expiryCopy =
    days === null
      ? null
      : days <= 1
        ? t('expiry.urgent')
        : t('expiry.soon', { days });

  return (
    <details
      className="group rounded-md border border-loftly-divider bg-loftly-surface p-2 text-caption"
      data-promo-id={promoId}
    >
      <summary className="flex cursor-pointer items-center gap-2 outline-none">
        <Badge
          variant={urgencyVariant}
          className={cn('whitespace-nowrap', urgencyClass)}
        >
          {label}
        </Badge>
        {expiryCopy && (
          <span
            className={cn(
              'text-caption text-loftly-ink-muted',
              days !== null && days <= 7 && 'text-loftly-danger',
            )}
          >
            {expiryCopy}
          </span>
        )}
      </summary>

      <div className="mt-2 space-y-1 border-t border-loftly-divider pt-2 text-loftly-ink">
        <p className="text-caption font-medium uppercase tracking-wide text-loftly-ink-muted">
          {t('chip.expandedTitle')}
        </p>
        {minSpend !== null && minSpend > 0 && (
          <p>
            {t('minSpend', {
              amount: new Intl.NumberFormat(
                locale === 'en' ? 'en-US' : 'th-TH',
              ).format(minSpend),
            })}
          </p>
        )}
        {validUntil && (
          <p className="text-loftly-ink-muted">
            {t('expiry.soon', { days: days ?? 0 })}
          </p>
        )}
        <a
          href={`/apply/promo/${encodeURIComponent(promoId)}`}
          rel="sponsored nofollow"
          className="mt-1 inline-block text-caption font-medium text-loftly-teal hover:text-loftly-teal-hover hover:underline"
        >
          {t('source')}
        </a>
        {sourceUrl && (
          <span className="sr-only">{sourceUrl}</span>
        )}
      </div>
    </details>
  );
}

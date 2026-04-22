import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';

/**
 * AffiliateDisclosure.
 *
 * Per UI_CONTENT.md §Affiliate disclosure:
 *   - `inline` variant: single sentence rendered near every Apply CTA
 *   - `footer` variant: long-form paragraph used on
 *     `/legal/affiliate-disclosure` and in page footers
 *
 * BRAND.md §7 principle #3: "Transparency over optimization theater — if we're
 * paid an affiliate commission, we disclose it."
 *
 * i18n: strings live in `messages/{th,en}.json` under `legal.affiliateDisclosure*`.
 */

export interface AffiliateDisclosureProps {
  variant?: 'inline' | 'footer';
  className?: string;
}

export async function AffiliateDisclosure({
  variant = 'inline',
  className,
}: AffiliateDisclosureProps) {
  const t = await getTranslations('legal');

  if (variant === 'inline') {
    return (
      <p
        className={cn('text-caption text-loftly-ink-muted', className)}
        data-testid="affiliate-disclosure-inline"
      >
        {t('affiliateDisclosureInline')}
      </p>
    );
  }

  return (
    <section
      className={cn(
        'space-y-2 text-body-sm leading-relaxed text-loftly-ink',
        className,
      )}
      data-testid="affiliate-disclosure-footer"
    >
      <h3 className="text-heading font-semibold text-loftly-ink">
        {t('affiliateDisclosureTitle')}
      </h3>
      <p>{t('affiliateDisclosureFull')}</p>
    </section>
  );
}

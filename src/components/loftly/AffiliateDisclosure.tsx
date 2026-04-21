import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * AffiliateDisclosure — STUB.
 *
 * Per UI_CONTENT.md §Affiliate disclosure:
 *   - inline variant: single sentence near every Apply CTA
 *   - footer variant: full 400–600 char disclosure for /legal/affiliate-disclosure
 *
 * BRAND.md §7 principle #3: "Transparency over optimization theater — if we're
 * paid an affiliate commission, we disclose it."
 */
export interface AffiliateDisclosureProps {
  variant?: 'inline' | 'footer';
  className?: string;
}

export function AffiliateDisclosure({ variant = 'inline', className }: AffiliateDisclosureProps) {
  const t = useTranslations('legal');

  if (variant === 'inline') {
    return (
      <p className={cn('text-xs text-slate-500', className)}>
        {t('affiliateDisclosureInline')}
      </p>
    );
  }

  // Footer variant — full long-form copy. Real copy lives in CMS or MDX later.
  return (
    <section className={cn('prose prose-sm max-w-none text-slate-700', className)}>
      <p>{t('affiliateDisclosureInline')}</p>
      {/* TODO: full long-form disclosure (400–600 chars TH + EN) */}
    </section>
  );
}

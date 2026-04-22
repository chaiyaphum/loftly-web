import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowRight, BarChart3, Search } from 'lucide-react';
import { MerchantSearchBar } from '@/components/merchants/MerchantSearchBar';

/**
 * DualHero — landing hero with merchant lookup + Selector as co-equal
 * CTAs (brief §15.2 + POSITIONING_SHIFT §4.1).
 *
 * Both cards share `loftly-surface` on `loftly-warm-white` with the
 * same border, shadow, and CTA prominence — neither is gradient-dimmed
 * to de-emphasize the other (per brief rule "either both are primary
 * or neither is"). Hovering one subtly dims the other via the
 * `group/hero` + sibling selectors.
 *
 * Responsive: desktop 50/50, mobile stacked with merchant on top.
 *
 * Returning-user personalization (POST_V1 §3) is not yet wired; when it
 * ships the right card should swap to a "ยินดีต้อนรับกลับ" variant.
 */
export async function DualHero(): Promise<React.ReactElement> {
  const t = await getTranslations('landing.dualHero');

  return (
    <section
      className="flex flex-col gap-10"
      aria-labelledby="landing-hero-heading"
    >
      <div className="flex flex-col gap-3 text-center">
        <h1
          id="landing-hero-heading"
          className="text-display-xl text-loftly-ink"
        >
          {t('heading')}
        </h1>
        <p className="mx-auto max-w-2xl text-body-lg text-loftly-ink-muted">
          {t('subheading')}
        </p>
      </div>

      <div className="group/hero grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left card — Merchant quick-lookup (primary entry) */}
        <article
          data-testid="dual-hero-merchant"
          className="peer/merchant group/card flex flex-col gap-5 rounded-lg border border-loftly-divider bg-loftly-surface p-6 shadow-subtle transition-all md:p-8 hover:-translate-y-0.5 hover:border-loftly-teal hover:shadow-elevated peer-hover/selector:opacity-70"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-loftly-teal-soft text-loftly-teal"
            >
              <Search className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-heading text-loftly-ink">
                {t('merchant.title')}
              </h2>
              <p className="text-body-sm text-loftly-ink-muted">
                {t('merchant.subtitle')}
              </p>
            </div>
          </div>
          <MerchantSearchBar variant="inline" />
          <Link
            href="/merchants"
            className="inline-flex items-center gap-1 self-start text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
          >
            {t('merchant.browseLink')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </article>

        {/* Right card — Selector deep-analysis */}
        <article
          data-testid="dual-hero-selector"
          className="peer/selector group/card flex flex-col gap-5 rounded-lg border border-loftly-divider bg-loftly-surface p-6 shadow-subtle transition-all md:p-8 hover:-translate-y-0.5 hover:border-loftly-teal hover:shadow-elevated peer-hover/merchant:opacity-70"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-loftly-amber/15 text-loftly-amber-urgent"
            >
              <BarChart3 className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-heading text-loftly-ink">
                {t('selector.title')}
              </h2>
              <p className="text-body-sm text-loftly-ink-muted">
                {t('selector.subtitle')}
              </p>
            </div>
          </div>
          <Link
            href="/selector"
            data-testid="dual-hero-selector-cta"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-loftly-teal px-5 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-loftly-teal-hover"
          >
            {t('selector.cta')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="text-caption text-loftly-ink-muted">
            {t('selector.reassurance')}
          </p>
        </article>
      </div>

      {/* Trust row — brief §15.2 */}
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-body-sm text-loftly-ink-muted">
        <li>{t('trust.promos')}</li>
        <li aria-hidden="true" className="text-loftly-divider">
          ·
        </li>
        <li>{t('trust.banks')}</li>
        <li aria-hidden="true" className="text-loftly-divider">
          ·
        </li>
        <li>{t('trust.merchants')}</li>
        <li aria-hidden="true" className="text-loftly-divider">
          ·
        </li>
        <li>{t('trust.bilingual')}</li>
        <li aria-hidden="true" className="text-loftly-divider">
          ·
        </li>
        <li>{t('trust.pdpa')}</li>
      </ul>
    </section>
  );
}

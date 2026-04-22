import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MerchantSearchBar } from '@/components/merchants/MerchantSearchBar';

/**
 * DualHero — landing hero with merchant lookup + Selector as co-equal CTAs.
 *
 * POSITIONING_SHIFT §15.2: replaces the single-CTA LandingHero after
 * the 2026-04-22 positioning shift. Merchant quick-lookup is now a
 * primary entry (not a secondary CTA below the hero). Card Selector
 * remains first-class for the deep-analysis path.
 *
 * Responsive:
 *   - Desktop (≥ 768px): side-by-side 50/50 cards
 *   - Mobile (< 768px):  stacked vertically, Merchant search on top
 *     (fewer taps to first value for drive-by search traffic)
 *
 * Returning-user personalization (POST_V1 §3) is temporarily NOT
 * wired through this component. When the flag flips on, the right
 * card should swap its content to a "ยินดีต้อนรับกลับ — your top card"
 * variant. Tracked as follow-up in DEVLOG.
 */

export async function DualHero(): Promise<React.ReactElement> {
  const t = await getTranslations('landing.dualHero');

  return (
    <section className="flex flex-col gap-8" aria-labelledby="landing-hero-heading">
      <div className="flex flex-col gap-2 text-center">
        <h1
          id="landing-hero-heading"
          className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl"
        >
          {t('heading')}
        </h1>
        <p className="text-base text-slate-600 sm:text-lg">{t('subheading')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left card — Merchant quick-lookup (primary entry) */}
        <div
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8"
          data-testid="dual-hero-merchant"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xl"
              aria-hidden="true"
            >
              🔍
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {t('merchant.title')}
              </h2>
              <p className="text-sm text-slate-600">{t('merchant.subtitle')}</p>
            </div>
          </div>
          <MerchantSearchBar variant="inline" />
          <Link
            href="/merchants"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
          >
            {t('merchant.browseLink')} →
          </Link>
        </div>

        {/* Right card — Selector deep-analysis */}
        <div
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8"
          data-testid="dual-hero-selector"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xl"
              aria-hidden="true"
            >
              📊
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {t('selector.title')}
              </h2>
              <p className="text-sm text-slate-600">{t('selector.subtitle')}</p>
            </div>
          </div>
          <Link
            href="/selector"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            data-testid="dual-hero-selector-cta"
          >
            {t('selector.cta')}
          </Link>
          <p className="text-xs text-slate-500">{t('selector.reassurance')}</p>
        </div>
      </div>

      {/* Trust row */}
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <li>{t('trust.promos')}</li>
        <li aria-hidden="true">·</li>
        <li>{t('trust.banks')}</li>
        <li aria-hidden="true">·</li>
        <li>{t('trust.merchants')}</li>
        <li aria-hidden="true">·</li>
        <li>{t('trust.bilingual')}</li>
        <li aria-hidden="true">·</li>
        <li>{t('trust.pdpa')}</li>
      </ul>
    </section>
  );
}

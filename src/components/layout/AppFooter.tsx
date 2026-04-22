'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

/**
 * Customer footer — brief §15.2 + POSITIONING_SHIFT §5.2 adds a
 * "Features" section alongside the legal links. Always-visible
 * affiliate notice satisfies brief §10 Flow F at site level; individual
 * Apply CTA contexts still render the inline `AffiliateDisclosure`.
 */
export function AppFooter() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-loftly-divider bg-loftly-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:px-6">
        <div className="space-y-2">
          <p className="text-heading font-semibold text-loftly-ink">
            {t('meta.siteName')}
          </p>
          <p className="text-body-sm text-loftly-ink-muted">
            {t('footer.affiliateNote')}
          </p>
        </div>

        <nav aria-label="Features" className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-loftly-ink-muted">
            {t('footer.featuresHeading')}
          </p>
          <ul className="space-y-1 text-body-sm">
            <li>
              <Link href="/features/promo-intelligence" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.featurePromoIntelligence')}
              </Link>
            </li>
            <li>
              <Link href="/features/merchant-lookup" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.featureMerchantLookup')}
              </Link>
            </li>
            <li>
              <Link href="/selector" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.featureSelector')}
              </Link>
            </li>
            <li>
              <Link href="/valuations" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.featureValuations')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Browse" className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-loftly-ink-muted">
            {t('footer.browseHeading')}
          </p>
          <ul className="space-y-1 text-body-sm">
            <li>
              <Link href="/merchants" className="text-loftly-ink hover:text-loftly-teal">
                {t('nav.merchants')}
              </Link>
            </li>
            <li>
              <Link href="/cards" className="text-loftly-ink hover:text-loftly-teal">
                {t('nav.cards')}
              </Link>
            </li>
            <li>
              <Link href="/promos-today" className="text-loftly-ink hover:text-loftly-teal">
                {t('nav.promosToday')}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-loftly-ink hover:text-loftly-teal">
                {t('nav.pricing')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Legal" className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-loftly-ink-muted">
            {t('footer.legalHeading')}
          </p>
          <ul className="space-y-1 text-body-sm">
            <li>
              <Link href="/legal/privacy" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.privacy')}
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.terms')}
              </Link>
            </li>
            <li>
              <Link href="/legal/affiliate-disclosure" className="text-loftly-ink hover:text-loftly-teal">
                {t('footer.affiliate')}
              </Link>
            </li>
            <li>
              <a
                href="/staging-ui-guide.html"
                className="text-loftly-ink hover:text-loftly-teal"
              >
                {t('footer.stagingGuide')}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-loftly-divider px-4 py-4 text-center text-caption text-loftly-ink-muted md:px-6">
        © {year} {t('meta.siteName')}
      </div>
    </footer>
  );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Building2, Search, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { MerchantSearchBar } from '@/components/merchants/MerchantSearchBar';

export const metadata: Metadata = buildPageMetadata({
  title: 'Merchant Lookup — ร้านไหน ใช้บัตรไหนคุ้ม',
  description:
    'ถามแบบจุดตรง: ร้าน X → บัตรไหนคุ้ม พร้อมคำนวณ THB ต่อเดือน ไม่ต้องไล่อ่านรีวิว 10 หน้า',
  path: '/features/merchant-lookup',
});

/**
 * /features/merchant-lookup — SSG marketing page explaining Idea 2
 * (brief §15.6). Long-scroll layout: hero → demo widget → reasons →
 * comparison vs. ChaiMiles/Punpro → CTAs into /merchants.
 */
export default async function MerchantLookupFeaturePage() {
  const t = await getTranslations('features.merchantLookup');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-12 md:px-6 md:py-16">
      {/* Hero */}
      <section className="flex flex-col gap-4 text-center">
        <span className="mx-auto inline-flex items-center gap-1 rounded-full bg-loftly-teal-soft px-3 py-1 text-caption font-medium text-loftly-teal">
          <Search className="h-3 w-3" aria-hidden />
          {t('eyebrow')}
        </span>
        <h1 className="text-display-xl text-loftly-ink">{t('heading')}</h1>
        <p className="mx-auto max-w-2xl text-body-lg text-loftly-ink-muted">
          {t('subheading')}
        </p>
      </section>

      {/* Demo widget */}
      <section className="flex flex-col gap-4 rounded-lg border border-loftly-divider bg-loftly-surface p-6 md:p-8">
        <h2 className="text-heading-lg text-loftly-ink">{t('demo.heading')}</h2>
        <p className="text-body text-loftly-ink-muted">{t('demo.body')}</p>
        <MerchantSearchBar variant="full" />
        <p className="text-caption text-loftly-ink-muted">{t('demo.hint')}</p>
      </section>

      {/* Why */}
      <section
        className="flex flex-col gap-6"
        aria-labelledby="why-heading"
      >
        <h2 id="why-heading" className="text-heading-lg text-loftly-ink">
          {t('why.heading')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(['concrete', 'live', 'bilingual'] as const).map((key) => (
            <article
              key={key}
              className="flex flex-col gap-2 rounded-lg border border-loftly-divider bg-loftly-surface p-6 shadow-subtle"
            >
              <Building2 className="h-5 w-5 text-loftly-teal" aria-hidden />
              <h3 className="text-heading text-loftly-ink">
                {t(`why.${key}.title`)}
              </h3>
              <p className="text-body-sm text-loftly-ink-muted">
                {t(`why.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section
        className="flex flex-col gap-4"
        aria-labelledby="compare-heading"
      >
        <h2 id="compare-heading" className="text-heading-lg text-loftly-ink">
          {t('compare.heading')}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-loftly-divider bg-loftly-surface">
          <table className="w-full text-body-sm">
            <thead className="bg-loftly-teal-soft/50">
              <tr className="text-left">
                <th className="p-3 text-caption font-medium uppercase tracking-wide text-loftly-ink-muted">
                  {t('compare.dimension')}
                </th>
                <th className="p-3 text-caption font-medium uppercase tracking-wide text-loftly-teal">
                  Loftly
                </th>
                <th className="p-3 text-caption font-medium uppercase tracking-wide text-loftly-ink-muted">
                  ChaiMiles
                </th>
                <th className="p-3 text-caption font-medium uppercase tracking-wide text-loftly-ink-muted">
                  Punpro
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-loftly-divider">
              {(['merchantAnswer', 'livePromo', 'thbMath', 'bilingual'] as const).map(
                (row) => (
                  <tr key={row}>
                    <td className="p-3 font-medium text-loftly-ink">
                      {t(`compare.rows.${row}.dim`)}
                    </td>
                    <td className="p-3 font-mono text-loftly-teal">
                      {t(`compare.rows.${row}.loftly`)}
                    </td>
                    <td className="p-3 text-loftly-ink-muted">
                      {t(`compare.rows.${row}.chaimiles`)}
                    </td>
                    <td className="p-3 text-loftly-ink-muted">
                      {t(`compare.rows.${row}.punpro`)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTAs */}
      <section className="flex flex-col items-start gap-6 rounded-lg bg-loftly-teal-soft p-8 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-loftly-surface px-2 py-0.5 text-caption font-medium text-loftly-teal">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t('cta.eyebrow')}
          </span>
          <h2 className="text-heading-lg text-loftly-ink">{t('cta.heading')}</h2>
          <p className="text-body text-loftly-ink-muted">{t('cta.body')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/merchants"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-loftly-teal px-5 text-body-sm font-medium text-white shadow-subtle hover:bg-loftly-teal-hover"
          >
            {t('cta.primary')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/merchants/starbucks"
            className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
          >
            {t('cta.secondary')} →
          </Link>
        </div>
      </section>
    </main>
  );
}

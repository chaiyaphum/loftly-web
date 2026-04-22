import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, BarChart3, Radio, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Promo Intelligence — สด จาก 3 ธนาคารไทยทุกวัน',
  description:
    'ข้อมูลโปรโมชันบัตรเครดิตไทยสด · อัปเดตทุกวัน · AI แนะนำบัตรที่คุ้มที่สุดต่อ spend ของคุณ',
  path: '/features/promo-intelligence',
});

/**
 * /features/promo-intelligence — SSG marketing page explaining Idea 1
 * (brief §15.6). Long-scroll: hero → pipeline explainer → 3 pillars →
 * CTAs into /selector.
 */
export default async function PromoIntelligenceFeaturePage() {
  const t = await getTranslations('features.promoIntelligence');

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-12 md:px-6 md:py-16">
      <section className="flex flex-col gap-4 text-center">
        <span className="mx-auto inline-flex items-center gap-1 rounded-full bg-loftly-teal-soft px-3 py-1 text-caption font-medium text-loftly-teal">
          <Radio className="h-3 w-3" aria-hidden />
          {t('eyebrow')}
        </span>
        <h1 className="text-display-xl text-loftly-ink">{t('heading')}</h1>
        <p className="mx-auto max-w-2xl text-body-lg text-loftly-ink-muted">
          {t('subheading')}
        </p>
      </section>

      {/* Pipeline explainer */}
      <section
        className="flex flex-col gap-6"
        aria-labelledby="pipeline-heading"
      >
        <h2 id="pipeline-heading" className="text-heading-lg text-loftly-ink">
          {t('pipeline.heading')}
        </h2>
        <ol className="grid gap-4 md:grid-cols-4">
          {(['harvest', 'canonicalize', 'value', 'surface'] as const).map(
            (step, idx) => (
              <li
                key={step}
                className="flex flex-col gap-2 rounded-lg border border-loftly-divider bg-loftly-surface p-5 shadow-subtle"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-loftly-teal-soft font-mono text-caption font-semibold text-loftly-teal">
                  {idx + 1}
                </span>
                <h3 className="text-heading text-loftly-ink">
                  {t(`pipeline.steps.${step}.title`)}
                </h3>
                <p className="text-body-sm text-loftly-ink-muted">
                  {t(`pipeline.steps.${step}.body`)}
                </p>
              </li>
            ),
          )}
        </ol>
      </section>

      {/* Pillars */}
      <section
        className="flex flex-col gap-6"
        aria-labelledby="why-heading"
      >
        <h2 id="why-heading" className="text-heading-lg text-loftly-ink">
          {t('why.heading')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(['freshness', 'thaiCoverage', 'aiReasoning'] as const).map((key) => (
            <article
              key={key}
              className="flex flex-col gap-2 rounded-lg border border-loftly-divider bg-loftly-surface p-6 shadow-subtle"
            >
              <BarChart3 className="h-5 w-5 text-loftly-teal" aria-hidden />
              <h3 className="text-heading text-loftly-ink">
                {t(`why.${key}.title`)}
              </h3>
              <p className="text-body-sm text-loftly-ink-muted">
                {t(`why.${key}.body`)}
              </p>
              <p className="mt-auto font-mono text-caption font-medium text-loftly-teal">
                {t(`why.${key}.stat`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
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
            href="/selector"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-loftly-teal px-5 text-body-sm font-medium text-white shadow-subtle hover:bg-loftly-teal-hover"
          >
            {t('cta.primary')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/promos-today"
            className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
          >
            {t('cta.secondary')} →
          </Link>
        </div>
      </section>
    </main>
  );
}

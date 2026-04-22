import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getValuation } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo/metadata';
import {
  bandForConfidence,
  ConfidenceBar,
} from '@/components/loftly/ConfidenceBar';
import { DistributionHistogram } from '@/components/loftly/DistributionHistogram';
import { ValuationHistoryTable } from '@/components/loftly/ValuationHistoryTable';
import type { ValuationDetail } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

/**
 * `/valuations/[currency]` detail page — the transparency surface.
 *
 * Per VALUATION_METHOD.md §Public methodology page, we show:
 *   - Hero with THB/point + confidence band
 *   - Short methodology explainer
 *   - Top redemption example (quote block)
 *   - Distribution histogram (p10/p25/p50/p75/p90)
 *   - Last 4 weekly valuations history
 *   - Last-updated timestamp
 *   - Link to cards earning this currency
 *
 * schema.org: Thing with `additionalProperty` for the valuation figure,
 * so search engines can index it.
 */

function formatHero(value: number, confidence: number): string {
  const band = bandForConfidence(confidence);
  if (band === 'range') {
    const lo = (value * 0.6).toFixed(3);
    const hi = (value * 1.4).toFixed(3);
    return `${lo}–${hi}`;
  }
  if (band === 'directional') {
    return `~${value.toFixed(3)}`;
  }
  return value.toFixed(4);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ currency: string }>;
}): Promise<Metadata> {
  const { currency } = await params;
  try {
    const v = await getValuation(currency);
    const name = v.currency.display_name_en ?? v.currency.code;
    const thbPerPoint = v.thb_per_point.toFixed(4);
    // Title reads naturally as "1 ROP = 0.3200 THB · Loftly" once the root
    // template appends "· Loftly".
    const title = `1 ${v.currency.code} = ${thbPerPoint} THB`;
    const description = `THB-per-point valuation for ${name} — ${thbPerPoint} THB/point at ${Math.round(v.confidence * 100)}% confidence, computed with the 80th-percentile methodology.`;
    return buildPageMetadata({
      title,
      description,
      path: `/valuations/${currency}`,
      ogType: 'article',
    });
  } catch {
    return buildPageMetadata({
      title: 'Currency valuation',
      path: `/valuations/${currency}`,
    });
  }
}

export default async function ValuationDetailPage({
  params,
}: {
  params: Promise<{ currency: string }>;
}) {
  const { currency } = await params;
  const t = await getTranslations('valuations');

  let detail: ValuationDetail;
  try {
    detail = (await getValuation(currency)) as ValuationDetail;
  } catch (err) {
    if (err instanceof LoftlyAPIError && err.status === 404) {
      notFound();
    }
    console.error('[valuations/[currency]] getValuation failed', err);
    throw err;
  }

  const band = bandForConfidence(detail.confidence);
  const heroValue = formatHero(detail.thb_per_point, detail.confidence);
  const updatedAt = detail.computed_at
    ? new Date(detail.computed_at).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const historyHeaders = t.raw('detail.historyHeaders') as {
    date: string;
    value: string;
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: detail.currency.display_name_en,
    identifier: detail.currency.code,
    description: detail.top_redemption_example ?? undefined,
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'thb_per_point',
        value: detail.thb_per_point,
        unitText: 'THB',
      },
      {
        '@type': 'PropertyValue',
        name: 'confidence',
        value: detail.confidence,
      },
      {
        '@type': 'PropertyValue',
        name: 'sample_size',
        value: detail.sample_size,
      },
      {
        '@type': 'PropertyValue',
        name: 'methodology',
        value: detail.methodology,
      },
    ],
  };

  const currencyLabel =
    detail.currency.display_name_th || detail.currency.display_name_en;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-4 text-xs text-loftly-ink-muted">
        <Link href="/valuations" className="hover:underline">
          {t('indexTitle')}
        </Link>
        <span className="mx-1">/</span>
        <span>{detail.currency.code}</span>
      </nav>

      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('currencyTitle', { currency: currencyLabel })}
        </h1>
        <p className="text-xs text-loftly-ink-muted">
          {t('detail.updatedAt', { date: updatedAt })}
        </p>
      </header>

      {/* Hero: big value + confidence */}
      <section
        className="mb-8 rounded-lg border border-loftly-divider bg-white p-6"
        data-testid="valuation-hero"
      >
        <div className="text-xs uppercase tracking-wide text-loftly-ink-muted">
          {t('detail.heroLabel')}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums text-loftly-ink">
            {heroValue}
          </span>
          <span className="text-base text-loftly-ink-muted">THB / point</span>
        </div>
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
            {t('detail.confidenceLabel')}
          </div>
          <ConfidenceBar
            value={detail.confidence}
            label={t('detail.confidenceLabel')}
            className="mt-1 max-w-sm"
          />
        </div>
        {band === 'range' && (
          <p
            role="note"
            className="mt-4 rounded-md bg-loftly-amber/15 p-3 text-xs text-loftly-amber-urgent"
          >
            {t('detail.underSampledBanner')}
          </p>
        )}
      </section>

      {/* Methodology explainer */}
      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold tracking-tight">
          {t('detail.methodologyTitle')}
        </h2>
        <p className="text-sm text-loftly-ink">
          {t('detail.methodologyBody', { samples: detail.sample_size })}
        </p>
      </section>

      {/* Top redemption example */}
      {detail.top_redemption_example && (
        <section className="mb-8">
          <h2 className="mb-2 text-xl font-semibold tracking-tight">
            {t('detail.topRedemption')}
          </h2>
          <blockquote className="rounded-md border-l-4 border-loftly-baht bg-loftly-teal-soft/40 p-4 text-sm italic text-loftly-ink">
            {detail.top_redemption_example}
          </blockquote>
        </section>
      )}

      {/* Distribution histogram */}
      {detail.distribution_summary && (
        <section className="mb-8">
          <h2 className="mb-2 text-xl font-semibold tracking-tight">
            {t('detail.distributionTitle')}
          </h2>
          <DistributionHistogram
            distribution={detail.distribution_summary}
            width={320}
            height={100}
            label={t('detail.distributionTitle')}
          />
        </section>
      )}

      {/* History */}
      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold tracking-tight">
          {t('detail.historyTitle')}
        </h2>
        <ValuationHistoryTable
          history={detail.history}
          headers={historyHeaders}
          limit={4}
        />
      </section>

      {/* Cards link */}
      <section>
        <Link
          href={`/cards?earn_currency=${encodeURIComponent(detail.currency.code)}`}
          className="text-sm text-loftly-baht hover:underline"
        >
          {t('detail.viewCardsCta', { currency: currencyLabel })}
        </Link>
      </section>
    </main>
  );
}

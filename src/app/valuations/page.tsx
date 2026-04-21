import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listValuations } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import { ValuationBadge } from '@/components/loftly/ValuationBadge';
import type { Valuation } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

/**
 * `/valuations` — public methodology index per VALUATION_METHOD.md.
 *
 * Renders all 8 currency valuations sorted per the Q4 decision: airlines
 * first (ROP, KrisFlyer, Asia Miles), then Bonvoy, then bank-proprietary
 * currencies. SSR against `GET /v1/valuations` with a 15-min cache window.
 */

// Sort priority: lower = earlier. Anything not listed lands at the end,
// ordered by currency_type group + code.
const SORT_ORDER: Record<string, number> = {
  ROP: 10,
  KF: 20,
  KRISFLYER: 20,
  AM: 30,
  ASIAMILES: 30,
  BONVOY: 40,
  K_POINT: 50,
  KPOINT: 50,
  UOB_REWARDS: 60,
  KTC_FOREVER: 70,
  SCB_REWARDS: 80,
};

const TYPE_FALLBACK: Record<string, number> = {
  airline: 100,
  hotel: 200,
  bank_proprietary: 300,
};

function sortValuations(data: Valuation[]): Valuation[] {
  return data.slice().sort((a, b) => {
    const aCode = a.currency.code.toUpperCase();
    const bCode = b.currency.code.toUpperCase();
    const ap = SORT_ORDER[aCode] ?? TYPE_FALLBACK[a.currency.currency_type] ?? 999;
    const bp = SORT_ORDER[bCode] ?? TYPE_FALLBACK[b.currency.currency_type] ?? 999;
    if (ap !== bp) return ap - bp;
    return aCode.localeCompare(bCode);
  });
}

export default async function ValuationsIndexPage() {
  const t = await getTranslations('valuations');
  const tc = await getTranslations('common');

  let valuations: Valuation[] = [];
  let loadError: string | null = null;
  try {
    const result = await listValuations();
    valuations = sortValuations(result.data ?? []);
  } catch (err) {
    if (err instanceof LoftlyAPIError) {
      console.error('[valuations] listValuations failed', err.code, err.message_en);
    } else {
      console.error('[valuations] listValuations unexpected', err);
    }
    loadError = t('loadError');
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Loftly point & mile valuations',
    description:
      'THB-per-point valuations for 8 Thai-relevant loyalty currencies, using the 80th-percentile methodology.',
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('indexTitle')}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          {t('indexSubtitle')}
        </p>
        <p className="text-xs text-slate-500">
          <Link
            href="/guides/how-loftly-calculates-point-valuations"
            className="text-loftly-baht hover:underline"
          >
            {t('methodologyGuideLink')}
          </Link>
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {loadError}
          <div className="mt-2">
            <Link href="/valuations" className="text-xs underline">
              {tc('retry')}
            </Link>
          </div>
        </div>
      )}

      {!loadError && valuations.length === 0 && (
        <p className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-600">
          {t('emptyState')}
        </p>
      )}

      {valuations.length > 0 && (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="valuations-grid"
        >
          {valuations.map((v) => {
            const name =
              v.currency.display_name_th || v.currency.display_name_en;
            return (
              <li
                key={v.currency.code}
                className="rounded-md border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <Link
                  href={`/valuations/${encodeURIComponent(v.currency.code)}`}
                  className="block space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{name}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {v.currency.code}
                    </span>
                  </div>
                  <ValuationBadge currency={v.currency} valuation={v} />
                  <div className="text-xs text-slate-500">
                    confidence {(v.confidence * 100).toFixed(0)}%
                    {' · '}
                    {t('detail.sampleCount', { n: v.sample_size })}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <Link
          href="/legal/valuation-method"
          className="text-loftly-baht hover:underline"
        >
          {t('methodologyLink')}
        </Link>
      </footer>
    </main>
  );
}

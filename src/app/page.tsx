import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getApiBase } from '@/lib/api/client';
import {
  LatestReviewsGrid,
  type LatestReviewsArticle,
} from '@/components/homepage/LatestReviewsGrid';
import { LatestValuationsList } from '@/components/homepage/LatestValuationsList';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { DualHero } from '@/components/landing/DualHero';
import { LivePromoStrip } from '@/components/landing/LivePromoStrip';
import type { Valuation } from '@/lib/api/types';

export const dynamic = 'force-static';
export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: 'รู้ทันทีว่าใช้บัตรไหนคุ้ม — ที่ทุกร้าน ทุกวัน',
  description:
    'Loftly — live Thai credit-card promo intelligence and merchant-first card recommendations. Know which card wins, at every merchant, every day.',
  path: '/',
});

/**
 * Landing page — wires the "รีวิวล่าสุด" and "มูลค่าแต้มล่าสุด" sections
 * to the staging API so the homepage demonstrates live content.
 *
 * Two server-side fetches run in parallel (`Promise.allSettled`), each
 * with a 5-minute ISR window (`next: { revalidate: 300 }`) to keep the
 * staging upstream well under its 120/min/IP budget while still feeling
 * "live" to editors previewing freshly-published content.
 *
 * Failure modes:
 *   - Network / 5xx → `result.status === 'rejected'` → section renders a
 *     small grey "ยังไม่มีข้อมูล" fallback (no error boundary bubble).
 *   - Empty list → section renders a friendly empty state with a link
 *     into `/cards`.
 */

type FetchState<T> =
  | { kind: 'data'; value: T }
  | { kind: 'error' };

const REVALIDATE_SECONDS = 300;

async function fetchLatestReviews(): Promise<
  FetchState<LatestReviewsArticle[]>
> {
  const base = getApiBase();
  const url = `${base}/articles?type=card_review&limit=6&order=published_at_desc`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as { data?: LatestReviewsArticle[] };
    return { kind: 'data', value: (body.data ?? []).slice(0, 6) };
  } catch {
    return { kind: 'error' };
  }
}

async function fetchLatestValuations(): Promise<FetchState<Valuation[]>> {
  const base = getApiBase();
  const url = `${base}/valuations?limit=5&order=updated_at_desc`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as { data?: Valuation[] };
    return { kind: 'data', value: (body.data ?? []).slice(0, 5) };
  } catch {
    return { kind: 'error' };
  }
}

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tn = await getTranslations('nav');

  const [reviews, valuations] = await Promise.all([
    fetchLatestReviews(),
    fetchLatestValuations(),
  ]);

  const errorFallback = t('loadError');
  const reviewsEmpty = t('latestReviewsEmpty');
  const valuationsEmpty = t('latestValuationsEmpty');
  const browseCards = t('browseAllCards');

  return (
    <>
      {/* LivePromoStrip sits outside the max-w container so its band extends
          full-width. Renders nothing if the backend can't supply fresh data. */}
      <LivePromoStrip />

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-8">
        {/* Dual hero — Merchant quick-lookup + Selector deep-analysis as
            co-equal primary CTAs (brief §15.2 + POSITIONING_SHIFT §4.1). */}
        <DualHero />

        {/* How it works */}
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">{t('howItWorksTitle')}</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                className="rounded-md border border-slate-200 p-4 text-slate-700"
              >
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  Step {n}
                </span>
                <span className="block">
                  {t(
                    `howItWorks.step${n}` as
                      | 'howItWorks.step1'
                      | 'howItWorks.step2'
                      | 'howItWorks.step3',
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Latest reviews */}
        <section className="flex flex-col gap-4" data-testid="latest-reviews">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{t('latestReviewsTitle')}</h2>
            <Link
              href="/cards"
              className="text-sm text-slate-600 hover:underline"
            >
              {tn('cards')} →
            </Link>
          </div>
          {reviews.kind === 'error' ? (
            <p
              role="status"
              data-testid="latest-reviews-error"
              className="text-sm text-slate-500"
            >
              {errorFallback}
            </p>
          ) : (
            <LatestReviewsGrid
              articles={reviews.value}
              emptyLabel={reviewsEmpty}
              browseAllLabel={browseCards}
            />
          )}
        </section>

        {/* Latest valuations */}
        <section
          className="flex flex-col gap-4"
          data-testid="latest-valuations"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {t('latestValuationsTitle')}
            </h2>
            <Link
              href="/valuations"
              className="text-sm text-slate-600 hover:underline"
            >
              {tn('valuations')} →
            </Link>
          </div>
          {valuations.kind === 'error' ? (
            <p
              role="status"
              data-testid="latest-valuations-error"
              className="text-sm text-slate-500"
            >
              {errorFallback}
            </p>
          ) : (
            <LatestValuationsList
              valuations={valuations.value}
              emptyLabel={valuationsEmpty}
              browseAllLabel={browseCards}
            />
          )}
        </section>

      </main>
    </>
  );
}

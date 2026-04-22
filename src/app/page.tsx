import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getApiBase } from '@/lib/api/client';
import {
  LatestReviewsGrid,
  type LatestReviewsArticle,
} from '@/components/homepage/LatestReviewsGrid';
import { LatestValuationsList } from '@/components/homepage/LatestValuationsList';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { DualHero } from '@/components/landing/DualHero';
import { LivePromoStrip } from '@/components/landing/LivePromoStrip';
import { SelectorCtaBlock } from '@/components/landing/SelectorCtaBlock';
import { TopMerchantsGrid } from '@/components/landing/TopMerchantsGrid';
import { TopPromosCarousel } from '@/components/landing/TopPromosCarousel';
import { WhyLoftly } from '@/components/landing/WhyLoftly';
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
 * Landing page — section order per brief §15.3:
 *
 *   1. LivePromoStrip (above hero, full-bleed)
 *   2. DualHero (merchant lookup + Selector, co-equal)
 *   3. TopPromosCarousel ("วันนี้โปรไหนน่าสนใจ?")
 *   4. TopMerchantsGrid ("ใช้บัตรไหนดีที่...")
 *   5. SelectorCtaBlock ("หรือบอกการใช้จ่ายของคุณ")
 *   6. WhyLoftly (3 pillars)
 *   7. LatestReviewsGrid
 *   8. LatestValuationsList
 */

type FetchState<T> =
  | { kind: 'data'; value: T }
  | { kind: 'error' };

const REVALIDATE_SECONDS = 300;

async function fetchLatestReviews(): Promise<FetchState<LatestReviewsArticle[]>> {
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
      <LivePromoStrip />

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 md:px-6 md:py-14">
        <DualHero />

        <TopPromosCarousel />

        <TopMerchantsGrid />

        <SelectorCtaBlock />

        <WhyLoftly />

        {/* Latest reviews */}
        <section
          className="flex flex-col gap-4"
          data-testid="latest-reviews"
          aria-labelledby="latest-reviews-heading"
        >
          <div className="flex items-end justify-between">
            <h2
              id="latest-reviews-heading"
              className="text-heading-lg text-loftly-ink"
            >
              {t('latestReviewsTitle')}
            </h2>
            <Link
              href="/cards"
              className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
            >
              {tn('cards')} →
            </Link>
          </div>
          {reviews.kind === 'error' ? (
            <p
              role="status"
              data-testid="latest-reviews-error"
              className="text-body-sm text-loftly-ink-muted"
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
          aria-labelledby="latest-valuations-heading"
        >
          <div className="flex items-end justify-between">
            <h2
              id="latest-valuations-heading"
              className="text-heading-lg text-loftly-ink"
            >
              {t('latestValuationsTitle')}
            </h2>
            <Link
              href="/valuations"
              className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
            >
              {tn('valuations')} →
            </Link>
          </div>
          {valuations.kind === 'error' ? (
            <p
              role="status"
              data-testid="latest-valuations-error"
              className="text-body-sm text-loftly-ink-muted"
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

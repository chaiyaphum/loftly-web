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
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingHeroSwitcher } from '@/components/landing/LandingHeroSwitcher';
import { MerchantSearchBar } from '@/components/merchants/MerchantSearchBar';
import type { Valuation } from '@/lib/api/types';

export const dynamic = 'force-static';
export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: 'ยกระดับทุกแต้มบัตรเครดิตของคุณ',
  description:
    'Loftly — AI-native credit card rewards optimization for Thailand. Find the card that makes every baht count.',
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
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-16 px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold">
          Loftly
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cards" className="text-slate-700 hover:underline">
            {tn('cards')}
          </Link>
          <Link
            href="/valuations"
            className="text-slate-700 hover:underline"
          >
            {tn('valuations')}
          </Link>
          <Link href="/pricing" className="text-slate-700 hover:underline">
            {tn('pricing')}
          </Link>
          <Link href="/onboarding" className="text-slate-700 hover:underline">
            {tn('signIn')}
          </Link>
        </nav>
      </header>

      {/* Hero — SSR renders the fresh-visitor LandingHero (A/B variant island).
          LandingHeroSwitcher hydrates on the client and, gated behind
          `post_v1_returning_landing`, either keeps the default hero or swaps in
          the POST_V1 §3 returning-user variant (personalized or expired banner). */}
      <LandingHeroSwitcher
        defaultHero={
          <LandingHero reassurance={t('reassurance')} ctaHref="/selector" />
        }
      />

      {/* Secondary CTA — Merchant Reverse Lookup search bar (post-v1 §9).
          Sits below the primary Selector hero so users who don't want to
          fill the full profile form can still ask "best card at Starbucks?"
          and land on a ranked answer. */}
      <section className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium text-slate-700">
          หรือค้นหาบัตรที่ดีที่สุดสำหรับร้านโปรดของคุณ
        </p>
        <MerchantSearchBar variant="inline" />
      </section>

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
      <section className="flex flex-col gap-4" data-testid="latest-valuations">
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

      <footer className="mt-auto border-t pt-6 text-sm text-slate-500">
        <div className="flex flex-wrap gap-4">
          <Link href="/legal/privacy">{t('footer.privacy')}</Link>
          <Link href="/legal/terms">{t('footer.terms')}</Link>
          <Link href="/legal/affiliate-disclosure">
            {t('footer.affiliate')}
          </Link>
        </div>
      </footer>
    </main>
  );
}

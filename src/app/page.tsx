import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { listCards, listValuations } from '@/lib/api/cards';
import { CardResultCard } from '@/components/loftly/CardResultCard';
import { ValuationBadge } from '@/components/loftly/ValuationBadge';
import type { Card as CardT, Valuation } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

/**
 * Landing page — tracks WF-1 more closely now:
 *   - Hero with Thai tagline + CTA → /selector
 *   - "How Loftly works" 3-step list
 *   - Latest reviews: top 3 cards from API
 *   - Latest valuations: up to 3 currencies from API (silently hidden on error)
 *   - Footer with PDPA + legal links
 */
export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tn = await getTranslations('nav');

  let topCards: CardT[] = [];
  let topValuations: Valuation[] = [];

  try {
    const cards = await listCards({ limit: 3 });
    topCards = cards.data ?? [];
  } catch {
    // Silent fallback — landing must always render.
  }

  try {
    const vals = await listValuations();
    topValuations = (vals.data ?? []).slice(0, 3);
  } catch {
    // Silent fallback — section hides below.
  }

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
          <Link href="/onboarding" className="text-slate-700 hover:underline">
            {tn('signIn')}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t('title')}
        </h1>
        <p className="text-lg text-slate-600">{t('subtitle')}</p>
        <div>
          <Button asChild size="lg">
            <Link href="/selector">{t('cta')}</Link>
          </Button>
        </div>
        <p className="text-sm text-slate-500">{t('reassurance')}</p>
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
                {t(`howItWorks.step${n}` as 'howItWorks.step1' | 'howItWorks.step2' | 'howItWorks.step3')}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Latest reviews */}
      {topCards.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {t('latestReviewsTitle')}
            </h2>
            <Link
              href="/cards"
              className="text-sm text-slate-600 hover:underline"
            >
              {tn('cards')} →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {topCards.map((card, i) => (
              <CardResultCard key={card.id} card={card} position={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Latest valuations */}
      {topValuations.length > 0 && (
        <section className="flex flex-col gap-4">
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
          <div className="flex flex-wrap gap-3">
            {topValuations.map((v) => (
              <ValuationBadge
                key={v.currency.code}
                currency={v.currency}
                valuation={v}
              />
            ))}
          </div>
        </section>
      )}

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

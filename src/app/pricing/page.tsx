import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PricingClient } from './PricingClient';

export const dynamic = 'force-dynamic';

/**
 * `/pricing` — flag-gated pricing page stub.
 *
 * Phase 1 tests pricing interest by routing visitors into three PostHog
 * variants of the `pricing_tier_test` flag:
 *   - `control` → single Free tier, no price shown
 *   - `variant_a_349` → Free + Premium THB 349/month (THB 3,490/year)
 *   - `variant_b_199` → Free + Premium THB 199/month (THB 1,990/year)
 *
 * There is no real checkout in Phase 1. Every Premium CTA is a "Waitlist"
 * signup that fires a PostHog event and stores the email via a stub
 * endpoint until the `/v1/waitlist` backend ships.
 */
export default async function PricingPage() {
  const t = await getTranslations('pricing');
  const tn = await getTranslations('nav');

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold">
          Loftly
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cards" className="text-slate-700 hover:underline">
            {tn('cards')}
          </Link>
          <Link href="/valuations" className="text-slate-700 hover:underline">
            {tn('valuations')}
          </Link>
          <Link
            href="/pricing"
            className="font-medium text-slate-900 underline underline-offset-4"
          >
            {tn('pricing')}
          </Link>
        </nav>
      </header>

      <section className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-lg text-slate-600">{t('subtitle')}</p>
      </section>

      <PricingClient />
    </main>
  );
}

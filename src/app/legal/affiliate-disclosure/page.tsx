import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AffiliateDisclosure } from '@/components/loftly/AffiliateDisclosure';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'Affiliate disclosure',
  description:
    'How Loftly earns commission from partner banks, and why it does not affect our editorial rankings or the offer you see.',
  path: '/legal/affiliate-disclosure',
});

export default async function AffiliateDisclosurePage() {
  const t = await getTranslations('legal');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">
          {t('affiliateDisclosureTitle')}
        </h1>
        <p className="text-sm text-loftly-ink-muted">
          {t('lastUpdatedLabel')}: {t('lastUpdatedValue')}
        </p>
      </header>

      <AffiliateDisclosure variant="footer" />

      <section className="space-y-2 text-sm leading-relaxed text-loftly-ink">
        <h2 className="text-lg font-semibold">How our partnerships work</h2>
        <p>
          When you apply for a card through a Loftly link, the issuing bank pays
          us a commission once your application is approved. The commission
          varies by partner and card; it does not change the offer you see or
          the terms the bank extends to you.
        </p>
        <p>
          Our editorial rankings and scores are computed by the same model for
          every card regardless of commercial relationship — see
          {' '}
          <Link href="/valuations" className="text-loftly-teal hover:underline">
            the methodology page
          </Link>{' '}
          for details.
        </p>
      </section>
    </main>
  );
}

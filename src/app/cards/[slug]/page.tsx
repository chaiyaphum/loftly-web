import { getTranslations } from 'next-intl/server';

// Placeholder for WF-4 card review page.
export default async function CardReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations('cards');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('reviewTitle')}</h1>
      <p className="mt-2 text-sm text-slate-500">card slug: {slug}</p>
      {/* TODO: hero, Loftly score, earn rates, valuation, benefits, promos, FAQ */}
    </main>
  );
}

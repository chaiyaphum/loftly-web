import { getTranslations } from 'next-intl/server';

export default async function ValuationDetailPage({
  params,
}: {
  params: Promise<{ currency: string }>;
}) {
  const { currency } = await params;
  const t = await getTranslations('valuations');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">
        {t('currencyTitle', { currency: currency.toUpperCase() })}
      </h1>
      {/* TODO: methodology, 80th-percentile math, historical chart */}
    </main>
  );
}

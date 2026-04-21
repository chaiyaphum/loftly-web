import { getTranslations } from 'next-intl/server';

export default async function ValuationsIndexPage() {
  const t = await getTranslations('valuations');

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('indexTitle')}</h1>
      {/* TODO: grid of 5 currencies with current THB/point */}
    </main>
  );
}

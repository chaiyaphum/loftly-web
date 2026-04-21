import { getTranslations } from 'next-intl/server';

export default async function CardsIndexPage() {
  const t = await getTranslations('cards');

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('indexTitle')}</h1>
      {/* TODO: filterable card grid, ISR against /v1/cards */}
    </main>
  );
}

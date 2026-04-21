import { getTranslations } from 'next-intl/server';

export default async function TermsPage() {
  const t = await getTranslations('legal');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('termsTitle')}</h1>
    </main>
  );
}

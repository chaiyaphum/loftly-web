import { getTranslations } from 'next-intl/server';

export default async function PrivacyPage() {
  const t = await getTranslations('legal');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('privacyTitle')}</h1>
      {/* TODO: versioned privacy policy, rendered from CMS or static MDX */}
    </main>
  );
}

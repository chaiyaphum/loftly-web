import { getTranslations } from 'next-intl/server';

export default async function AccountConsentPage() {
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('consentTitle')}</h1>
      {/* TODO: consent management with revocation flow */}
    </main>
  );
}

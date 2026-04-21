import { getTranslations } from 'next-intl/server';

export default async function AccountDeletePage() {
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('deleteTitle')}</h1>
      {/* TODO: confirmation flow for account deletion (PDPA Right to erasure) */}
    </main>
  );
}

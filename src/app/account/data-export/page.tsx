import { getTranslations } from 'next-intl/server';

export default async function AccountDataExportPage() {
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('exportTitle')}</h1>
      {/* TODO: request personal data export (PDPA Right to access) */}
    </main>
  );
}

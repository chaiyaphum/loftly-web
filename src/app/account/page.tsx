import { getTranslations } from 'next-intl/server';

export default async function AccountPage() {
  const t = await getTranslations('account');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      {/* TODO: profile summary, links to consent / data-export / delete */}
    </main>
  );
}

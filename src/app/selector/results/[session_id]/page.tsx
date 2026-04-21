import { getTranslations } from 'next-intl/server';

// Placeholder for WF-3. Session id comes from /v1/selector response.
export default async function SelectorResultsPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  const { session_id } = await params;
  const t = await getTranslations('results');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-sm text-slate-500">session: {session_id}</p>
      {/* TODO: primary card, email gate, AI rationale stream — WF-3 */}
    </main>
  );
}

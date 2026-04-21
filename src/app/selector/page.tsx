import { getTranslations } from 'next-intl/server';

// Placeholder — form + slider + goal picker are a later milestone.
// See UI_WEB.md WF-2 for the target wireframe.
export default async function SelectorPage() {
  const t = await getTranslations('selector');

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      {/* TODO: SpendCategorySliders, GoalPicker, current cards — WF-2 */}
    </main>
  );
}

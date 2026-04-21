import { getTranslations } from 'next-intl/server';

export default async function OnboardingPage() {
  const t = await getTranslations('onboarding');

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      {/* TODO: Google / Apple / LINE OAuth buttons (Phase 1 Week 2+) */}
    </main>
  );
}

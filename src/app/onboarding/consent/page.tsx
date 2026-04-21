import { getTranslations } from 'next-intl/server';

// Placeholder for WF-5 — 4-toggle PDPA consent matrix.
export default async function OnboardingConsentPage() {
  const t = await getTranslations('onboarding');

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('consentTitle')}</h1>
      {/* TODO: PDPAConsentMatrix with 4 purposes: optimization (required), marketing, analytics, sharing */}
    </main>
  );
}

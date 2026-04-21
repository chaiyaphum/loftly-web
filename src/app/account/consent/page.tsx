import { getTranslations } from 'next-intl/server';
import { getConsent } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import type { ConsentState } from '@/lib/api/types';
import { ConsentForm } from '@/app/onboarding/consent/ConsentForm';

export const dynamic = 'force-dynamic';

const DEFAULT_POLICY_VERSION = '1.0.2';

const DEFAULT_CONSENT: ConsentState = {
  policy_version: DEFAULT_POLICY_VERSION,
  consents: {
    optimization: true,
    marketing: false,
    analytics: false,
    sharing: false,
  },
};

export default async function AccountConsentPage() {
  const t = await getTranslations('consent');

  let initial = DEFAULT_CONSENT;
  try {
    initial = await getConsent(null);
  } catch (err) {
    if (!(err instanceof LoftlyAPIError) || err.status !== 401) {
      console.warn('[account/consent] getConsent failed; using defaults', err);
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('manageTitle')}
        </h1>
      </header>

      <ConsentForm
        initial={initial}
        policyVersion={initial.policy_version || DEFAULT_POLICY_VERSION}
        manageMode
      />
    </main>
  );
}

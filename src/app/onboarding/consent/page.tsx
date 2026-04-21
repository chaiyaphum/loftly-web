import { getTranslations } from 'next-intl/server';
import { getConsent } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import type { ConsentState } from '@/lib/api/types';
import { ConsentForm } from './ConsentForm';
import { Badge } from '@/components/ui/badge';

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

type SearchParams = Promise<{ provider?: string; _mock?: string }>;

export default async function OnboardingConsentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const t = await getTranslations('consent');
  const to = await getTranslations('onboarding');

  // Best-effort fetch of current consent state — backend session is stubbed,
  // so we gracefully fall back to the default "fresh user" state.
  let initial = DEFAULT_CONSENT;
  try {
    initial = await getConsent(null);
  } catch (err) {
    if (!(err instanceof LoftlyAPIError) || err.status !== 401) {
      console.warn('[consent] getConsent failed; using defaults', err);
    }
  }

  const isMock = sp?._mock === 'true';

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('pageTitle')}
        </h1>
        {sp?.provider && (
          <p className="mt-2 text-sm text-slate-600">
            {to('signInWith', {
              provider: to(`providers.${sp.provider as 'google' | 'apple' | 'line'}`),
            })}
          </p>
        )}
        {isMock && (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <Badge variant="warn" className="mr-2">
              MOCK
            </Badge>
            {to('mockNotice')}
          </div>
        )}
      </header>

      <ConsentForm
        initial={initial}
        policyVersion={initial.policy_version || DEFAULT_POLICY_VERSION}
      />
    </main>
  );
}

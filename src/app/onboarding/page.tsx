import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { NOINDEX_METADATA } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'เริ่มใช้งาน Loftly',
};

const PROVIDERS = ['line', 'google', 'apple'] as const;

type OnboardingSearchParams = {
  next?: string;
  session_id?: string;
  error?: string;
};

/**
 * Onboarding — sign-in provider picker.
 *
 * Each button is a link to `/api/auth/oauth/start?provider=…` which 302s to
 * the provider's authorize URL. If env vars for the selected provider are
 * unset, the start route short-circuits to the callback with a
 * `provider_not_configured` error which surfaces here via `?error=…`.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<OnboardingSearchParams>;
}) {
  const t = await getTranslations('onboarding');
  const sp = await searchParams;

  const errorKey =
    sp.error === 'oauth_provider_unavailable'
      ? 'oauth_provider_unavailable'
      : sp.error
        ? 'oauth_failed'
        : null;

  const qs = new URLSearchParams();
  if (sp.next) qs.set('next', sp.next);
  if (sp.session_id) qs.set('session_id', sp.session_id);
  const baseQuery = qs.toString() ? `&${qs.toString()}` : '';

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-loftly-ink-muted">{t('subtitle')}</p>
      </div>

      {errorKey && (
        <div
          role="alert"
          className="rounded-md bg-loftly-danger/10 p-3 text-sm text-loftly-danger"
        >
          {t(`errors.${errorKey}` as 'errors.oauth_failed')}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {PROVIDERS.map((provider) => (
          <Button
            key={provider}
            asChild
            variant="outline"
            size="lg"
            className="justify-center"
          >
            <a
              href={`/api/auth/oauth/start?provider=${provider}${baseQuery}`}
              data-provider={provider}
            >
              {t('signInWith', { provider: t(`providers.${provider}`) })}
            </a>
          </Button>
        ))}
      </div>
    </main>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const PROVIDERS = ['line', 'google', 'apple'] as const;

export default async function OnboardingPage() {
  const t = await getTranslations('onboarding');

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        <Badge variant="warn" className="mr-2">
          MOCK
        </Badge>
        {t('mockNotice')}
      </div>

      <div className="flex flex-col gap-3">
        {PROVIDERS.map((provider) => (
          <Button
            key={provider}
            asChild
            variant="outline"
            size="lg"
            className="justify-center"
          >
            <Link
              href={`/onboarding/consent?provider=${provider}&_mock=true`}
              data-provider={provider}
            >
              {t('signInWith', { provider: t(`providers.${provider}`) })}
            </Link>
          </Button>
        ))}
      </div>
    </main>
  );
}

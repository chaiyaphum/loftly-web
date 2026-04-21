import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * Soft-launch invite-code gate page (W11, capped at 100 users).
 *
 * Rendered when middleware cannot verify `loftly_invite`. Form posts to
 * `/api/invite`, which sets the cookie on success and 303-redirects to `/`.
 * Errors are surfaced via `?error=invalid` on the URL.
 */
export default async function InviteRequiredPage({ searchParams }: PageProps) {
  const t = await getTranslations('invite');
  const params = await searchParams;
  const hasError = params.error === 'invalid';

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold text-loftly-ink">{t('title')}</h1>
      <p className="mt-3 text-sm text-slate-600">{t('subtitle')}</p>

      <form
        method="post"
        action="/api/invite"
        className="mt-8 space-y-4"
        aria-describedby={hasError ? 'invite-error' : undefined}
      >
        <div className="space-y-2">
          <label htmlFor="invite-code" className="block text-sm font-medium text-loftly-ink">
            {t('codeLabel')}
          </label>
          <Input
            id="invite-code"
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            minLength={4}
            maxLength={64}
            aria-invalid={hasError || undefined}
            aria-errormessage={hasError ? 'invite-error' : undefined}
            placeholder={t('codePlaceholder')}
          />
          <p className="text-xs text-slate-500">{t('codeHint')}</p>
        </div>

        {hasError ? (
          <p
            id="invite-error"
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {t('errorInvalid')}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full">
          {t('submit')}
        </Button>
      </form>

      <p className="mt-6 text-xs text-slate-500">{t('noAccess')}</p>
    </main>
  );
}

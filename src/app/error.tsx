'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

/**
 * Root error boundary for the App Router. Catches uncaught errors from
 * server components and any unhandled client errors. Must be a client
 * component per Next.js 15 App Router convention.
 *
 * Sentry: `@sentry/nextjs` is wired via `next.config.mjs` + client/edge/server
 * config files. We still call `captureException` directly on mount because the
 * auto-capture path for the `error.tsx` boundary is not wired in this project.
 * Skipped in non-production to avoid noise during local dev.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.serverError');
  const tSkip = useTranslations('errors');
  const supportEmail =
    process.env.NEXT_PUBLIC_FOUNDER_NOTIFY_EMAIL || 'support@loftly.co.th';

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {tSkip('skipToMain')}
      </a>
      <main
        id="main-content"
        className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-6 py-8 text-center"
      >
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          500
        </p>
        <h1 className="text-3xl font-semibold text-loftly-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-3 text-base text-slate-600">{t('subtitle')}</p>

        {error.digest ? (
          <p
            className="mt-4 font-mono text-xs text-slate-500"
            data-testid="error-digest"
          >
            {t('errorCode', { digest: error.digest })}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            onClick={() => reset()}
            aria-label={t('cta_retry')}
          >
            {t('cta_retry')}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/" aria-label={t('cta_home')}>
              {t('cta_home')}
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          {t('supportText', { email: supportEmail })
            .split(supportEmail)
            .flatMap((chunk, i, arr) =>
              i < arr.length - 1
                ? [
                    chunk,
                    <a
                      key={i}
                      href={`mailto:${supportEmail}`}
                      className="text-loftly-baht underline underline-offset-2 hover:opacity-80"
                    >
                      {supportEmail}
                    </a>,
                  ]
                : [chunk],
            )}
        </p>
      </main>
    </>
  );
}

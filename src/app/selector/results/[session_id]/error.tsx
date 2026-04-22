'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

/**
 * Scoped error boundary for `/selector/results/[session_id]`.
 *
 * Mirrors `src/app/error.tsx` but lives next to the selector-results route
 * because the LLM-backed selector is the most likely surface to genuinely
 * crash (model outage, upstream 5xx, timeout). Keeping the boundary local
 * means we don't unmount the rest of the customer shell on a transient
 * selector failure.
 */
export default function SelectorResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.serverError');
  const tResults = useTranslations('selector.results.error');
  const supportEmail =
    process.env.NEXT_PUBLIC_FOUNDER_NOTIFY_EMAIL || 'support@loftly.co.th';

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-wide text-loftly-ink-muted">
        500
      </p>
      <h1 className="text-3xl font-semibold text-loftly-ink sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 text-base text-loftly-ink-muted">{t('subtitle')}</p>

      {error.digest ? (
        <p
          className="mt-4 font-mono text-xs text-loftly-ink-muted"
          data-testid="selector-error-digest"
        >
          {t('errorCode', { digest: error.digest })}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          size="lg"
          onClick={() => reset()}
          aria-label={tResults('retry')}
        >
          {tResults('retry')}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/selector" aria-label={tResults('notFoundCta')}>
            {tResults('notFoundCta')}
          </Link>
        </Button>
      </div>

      <p className="mt-8 text-xs text-loftly-ink-muted">
        {t('supportText', { email: supportEmail })
          .split(supportEmail)
          .flatMap((chunk, i, arr) =>
            i < arr.length - 1
              ? [
                  chunk,
                  <a
                    key={i}
                    href={`mailto:${supportEmail}`}
                    className="text-loftly-teal underline underline-offset-2 hover:opacity-80"
                  >
                    {supportEmail}
                  </a>,
                ]
              : [chunk],
          )}
      </p>
    </main>
  );
}

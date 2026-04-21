'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Client-side error surface for `/selector/results/[session_id]`.
 *
 * We split by HTTP status rather than backend `code` so the UX stays stable
 * if codes are renamed:
 *   - 404 → "ไม่พบผลการค้นหา" + CTA back to `/selector`
 *   - 410 → "ผลลัพธ์หมดอายุแล้ว" + CTA to re-run (24h TTL)
 *   - anything else / 5xx / timeout → generic "เกิดข้อผิดพลาด" + Retry button
 *
 * `retry` re-fetches with exponential backoff (1s → 2s → 4s). It is handed
 * in by the server page so the retried fetch runs in a server action (keeps
 * auth cookie forwarding consistent).
 *
 * When `retry` is omitted (or `kind === 'notFound' | 'expired'`), we render a
 * static CTA instead; those error cases are not recoverable by reload.
 */

export type ResultsErrorKind = 'notFound' | 'expired' | 'generic';

export function statusToKind(status: number | undefined | null): ResultsErrorKind {
  if (status === 404) return 'notFound';
  if (status === 410) return 'expired';
  return 'generic';
}

interface Props {
  kind: ResultsErrorKind;
  /**
   * Triggered when the user taps "Reload". Should perform a fetch + return
   * a promise that resolves when the reload succeeds (so we can hide spinner).
   * When not provided, retry is disabled (e.g. 404/410).
   */
  onRetry?: () => Promise<void> | void;
  /**
   * When true, the caller has chosen to reload the whole route (Next's
   * `router.refresh()`) rather than refetching client-side. We still provide
   * backoff so the server doesn't get hammered.
   */
  maxAttempts?: number;
}

const BACKOFF_MS = [1000, 2000, 4000];

export function ResultsError({ kind, onRetry, maxAttempts = 3 }: Props) {
  const t = useTranslations('selector.results.error');
  const [retrying, setRetrying] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);

  const handleRetry = React.useCallback(async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      // Attempt up to maxAttempts with exponential backoff on failure.
      for (let i = 0; i < maxAttempts; i += 1) {
        setAttempts(i + 1);
        try {
          await onRetry();
          return;
        } catch {
          if (i === maxAttempts - 1) throw new Error('retry_exhausted');
          await new Promise<void>((resolve) =>
            setTimeout(resolve, BACKOFF_MS[i] ?? 4000),
          );
        }
      }
    } catch {
      // Swallow — caller can re-render with a new kind if they want.
    } finally {
      setRetrying(false);
    }
  }, [onRetry, retrying, maxAttempts]);

  return (
    <main
      className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center"
      data-testid="selector-results-error"
      data-kind={kind}
    >
      <p className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        {kind === 'notFound' && t('notFound')}
        {kind === 'expired' && t('expired')}
        {kind === 'generic' && t('generic')}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        {kind === 'notFound' && (
          <Button asChild size="lg">
            <Link href="/selector" data-testid="selector-error-cta-notfound">
              {t('notFoundCta')}
            </Link>
          </Button>
        )}
        {kind === 'expired' && (
          <Button asChild size="lg">
            <Link href="/selector" data-testid="selector-error-cta-expired">
              {t('expiredCta')}
            </Link>
          </Button>
        )}
        {kind === 'generic' && (
          <Button
            size="lg"
            onClick={handleRetry}
            disabled={retrying || !onRetry}
            data-testid="selector-error-cta-retry"
            aria-live="polite"
          >
            {retrying
              ? `${t('retry')} (${attempts}/${maxAttempts})`
              : t('retry')}
          </Button>
        )}
      </div>
    </main>
  );
}

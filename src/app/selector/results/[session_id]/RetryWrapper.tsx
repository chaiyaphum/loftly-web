'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ResultsError, type ResultsErrorKind } from './ResultsError';

/**
 * Thin client wrapper around `ResultsError` that wires the retry handler to
 * Next.js `router.refresh()` for the `generic` error kind.
 *
 * `router.refresh()` re-runs the server component (and therefore the
 * `getSelectorResult` fetch) without blowing away client state — ideal for
 * a transient 500 / timeout. The backoff + attempt counter lives inside
 * `ResultsError`; this wrapper just supplies the retry function.
 *
 * For `notFound` / `expired` kinds we do NOT wire a retry — a reload won't
 * help and the error component shows a hard CTA instead.
 */

interface Props {
  kind: ResultsErrorKind;
}

export function RetryWrapper({ kind }: Props) {
  const router = useRouter();
  const retry = React.useCallback(async () => {
    // `router.refresh()` doesn't return a promise; wrap in a microtask so the
    // ResultsError spinner has something to await. We resolve immediately —
    // the server re-render will blow away this error surface on success.
    router.refresh();
    await Promise.resolve();
  }, [router]);

  return (
    <ResultsError
      kind={kind}
      onRetry={kind === 'generic' ? retry : undefined}
    />
  );
}

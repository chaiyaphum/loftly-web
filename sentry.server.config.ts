/**
 * Sentry server-side init — no-ops when DSN unset.
 *
 * Noise-drop policy (W18): mirrors loftly-api#8. Server-side we still drop
 * aborted requests (common when clients disconnect mid-stream).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

const tracesSampleRate =
  process.env.NODE_ENV === 'development'
    ? 1.0
    : Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE ??
          process.env.SENTRY_TRACES_SAMPLE_RATE ??
          '0.1',
      );

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    tracesSampleRate,
    ignoreErrors: [
      'Non-Error promise rejection captured',
      'Network request failed',
      /AbortError/i,
    ],
    beforeSend(event) {
      const exception = event.exception?.values?.[0];
      const errType = exception?.type ?? '';
      const errValue = exception?.value ?? '';
      const errMessage = `${errType}: ${errValue}`;

      if (
        errType === 'AbortError' ||
        errType === 'ChunkLoadError' ||
        errMessage.includes('AbortError: The user aborted')
      ) {
        return null;
      }

      if (errValue.includes('Event dropped due to ignoredErrors')) {
        return null;
      }

      return event;
    },
  });
}

/**
 * Sentry browser init — no-ops when `NEXT_PUBLIC_SENTRY_DSN` is unset so the
 * bundle still builds without credentials (per DEPLOYMENT.md gating rule).
 *
 * Noise-drop policy (W18): mirrors loftly-api#8. We drop transient browser
 * errors that aren't actionable (extension frames, aborted requests,
 * ResizeObserver loop warnings, offline fetch failures).
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// tracesSampleRate: env-driven, default 0.1 in prod, 1.0 in development.
const tracesSampleRate =
  process.env.NODE_ENV === 'development'
    ? 1.0
    : Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE ?? '0.1');

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || 'production',
    tracesSampleRate,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Network request failed',
      /AbortError/i,
      /extension\//i,
    ],
    beforeSend(event) {
      // Never leak raw JWT cookies; Sentry SDK strips most PII by default but
      // double-check request.headers.
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      // Noise-drop filters (W18).
      const exception = event.exception?.values?.[0];
      const errType = exception?.type ?? '';
      const errValue = exception?.value ?? '';
      const errMessage = `${errType}: ${errValue}`;

      // 1. Drop well-known transient error types.
      if (
        errType === 'AbortError' ||
        errType === 'ChunkLoadError' ||
        errMessage.includes('AbortError: The user aborted')
      ) {
        return null;
      }

      // 2. Drop any event where a stack frame originates in a browser extension.
      const frames = exception?.stacktrace?.frames ?? [];
      for (const frame of frames) {
        const filename = frame?.filename ?? '';
        if (
          filename.includes('chrome-extension://') ||
          filename.includes('moz-extension://')
        ) {
          return null;
        }
      }

      // 3. Drop "Failed to fetch" when the browser is known offline —
      // this is an app-layer concern, not a Sentry-worthy error.
      if (
        typeof navigator !== 'undefined' &&
        navigator.onLine === false &&
        errType === 'TypeError' &&
        errValue.includes('Failed to fetch')
      ) {
        return null;
      }

      // 4. Defensive: redundant with ignoreErrors but explicit.
      if (errValue.includes('Event dropped due to ignoredErrors')) {
        return null;
      }

      return event;
    },
  });
}

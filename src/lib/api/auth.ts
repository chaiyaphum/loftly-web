import { apiFetch } from './client';
import type { TokenPair } from './types';

/**
 * Auth API helpers — magic-link flow per openapi.yaml
 * `/v1/auth/magic-link/{request,consume}`.
 *
 * - `requestMagicLink(email, sessionId?)` — sends the email; backend returns
 *   202. We don't expose the 202 status to callers; Promise<void> is enough.
 * - `consumeMagicLink(token)` — trades the signed token for a `TokenPair`.
 *   The caller (typically a server component in `/auth/magic-link/consume`)
 *   is responsible for storing the access token as an HTTP-only cookie.
 */

export async function requestMagicLink(
  email: string,
  sessionId?: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  await apiFetch<void>('/auth/magic-link/request', {
    method: 'POST',
    body: {
      email,
      ...(sessionId ? { session_id: sessionId } : {}),
    },
    accessToken: null,
    revalidate: false,
    signal: opts.signal,
  });
}

export function consumeMagicLink(
  token: string,
  opts: { signal?: AbortSignal } = {},
): Promise<TokenPair> {
  return apiFetch<TokenPair>('/auth/magic-link/consume', {
    method: 'POST',
    body: { token },
    accessToken: null,
    revalidate: false,
    signal: opts.signal,
    // Consume is single-use server-side; no retry (idempotency not guaranteed).
    maxRetries: 0,
  });
}

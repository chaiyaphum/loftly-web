import { apiFetch } from './client';

/**
 * `/v1/me` — current user profile for the account settings landing page.
 *
 * Shape mirrors the anticipated openapi.yaml contract:
 *   GET /v1/me  (Bearer auth)
 *   200 → { email, created_at, last_login_at }
 *
 * NOTE (2026-04-21): the backend endpoint is not live yet. Callers should
 * catch `LoftlyAPIError` and degrade gracefully — the account landing page
 * renders a minimal hero without the profile fields when this returns 404
 * / 501. Once the backend lands this function keeps the same signature.
 */

export interface MeProfile {
  email: string;
  created_at: string;
  last_login_at: string | null;
}

export function getMe(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<MeProfile> {
  return apiFetch<MeProfile>('/me', {
    method: 'GET',
    accessToken,
    revalidate: false,
    signal: opts.signal,
  });
}

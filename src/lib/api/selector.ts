import { apiFetch } from './client';
import type {
  SelectorInput,
  SelectorResult,
  SpendNLURequest,
  SpendNLUResponse,
} from './types';

/**
 * Card Selector API helpers — thin wrappers around `/v1/selector` endpoints.
 *
 * - `submitSelector` POSTs a SelectorInput and returns the ranked stack.
 *   Phase 1 uses JSON mode (streaming is deferred to W7+ per SPEC §2).
 * - `getSelectorResult` retrieves a previously-generated session by id,
 *   optionally passing a signed `token` from a magic link for anon unlock.
 *
 * Both endpoints are public; authenticated callers may pass `accessToken` to
 * unlock the full stack when a user JWT is already present.
 */

export function submitSelector(
  input: SelectorInput,
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<SelectorResult> {
  return apiFetch<SelectorResult>('/selector', {
    method: 'POST',
    body: input,
    accessToken: opts.accessToken ?? null,
    // Selector calls are user-driven; no SSG caching.
    revalidate: false,
    signal: opts.signal,
    // Larger budget — LLM-backed endpoint can take several seconds.
    timeoutMs: 20_000,
    // Don't retry LLM calls automatically; backend dedupes via cache.
    maxRetries: 0,
  });
}

/**
 * Typhoon free-text Thai NLU parse — POST /v1/selector/parse-nlu.
 *
 * Backend is gated by the `typhoon_nlu_spend` server-side flag:
 *   - 501 when flag OFF or Typhoon not configured
 *   - 502 on malformed LLM JSON
 *   - 504 on upstream timeout
 *
 * 30s client timeout — Typhoon's 5s upstream budget + retry headroom.
 * No retry; backend already retries once on 429/503.
 */
export function parseSpendNlu(
  input: SpendNLURequest,
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<SpendNLUResponse> {
  return apiFetch<SpendNLUResponse>('/selector/parse-nlu', {
    method: 'POST',
    body: input,
    accessToken: opts.accessToken ?? null,
    revalidate: false,
    signal: opts.signal,
    timeoutMs: 30_000,
    maxRetries: 0,
  });
}

export function getSelectorResult(
  sessionId: string,
  token?: string | null,
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<SelectorResult> {
  return apiFetch<SelectorResult>(
    `/selector/${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      query: token ? { token } : undefined,
      accessToken: opts.accessToken ?? null,
      revalidate: false,
      signal: opts.signal,
    },
  );
}

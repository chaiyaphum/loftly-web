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

/**
 * Response shape for `GET /v1/selector/recent` — the returning-user recognition
 * lookup powering POST_V1 §3. The backend reads Redis by `session_id` and
 * returns either:
 *   - `expired: false` + the top card snapshot → personalized landing variant,
 *   - `expired: true` + nulls → "you were here, want to retry?" banner,
 *   - 404 / network error → caller renders the default fresh-visitor hero.
 *
 * Card `name` is a display string only; no points, rates, or PII are leaked.
 */
export interface RecentSessionResponse {
  card_name: string | null;
  card_id: string | null;
  hours_since_last_session: number | null;
  expired: boolean;
}

/**
 * Look up the caller's most-recent Selector session. The `session_id` comes
 * from the client-readable `loftly_selector_session` cookie (see
 * `src/lib/selector-session-cookie.ts`), so this call is safe to make from a
 * client component post-hydration.
 *
 * Short 3s timeout + no retry: personalization is best-effort and must not
 * block the fresh-visitor hero if Redis is momentarily unreachable.
 */
export function getRecentSelectorSession(
  sessionId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RecentSessionResponse> {
  return apiFetch<RecentSessionResponse>(
    `/selector/recent?session_id=${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      accessToken: null,
      revalidate: false,
      signal: opts.signal,
      timeoutMs: 3_000,
      maxRetries: 0,
    },
  );
}

/**
 * Archive the stale Redis profile before redirecting the returning user
 * to a fresh `/selector` run. The backend preserves the hash for 24h so
 * `/selector/results/[id]` direct links keep working — only the "most
 * recent" index is cleared, per POST_V1 §3 acceptance criteria.
 *
 * Errors are swallowed by callers: failing to archive is not worth blocking
 * the user's restart intent.
 */
export function archiveSelectorSession(
  sessionId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  return apiFetch<void>(
    `/selector/${encodeURIComponent(sessionId)}/archive`,
    {
      method: 'POST',
      accessToken: null,
      revalidate: false,
      signal: opts.signal,
      timeoutMs: 3_000,
      maxRetries: 0,
    },
  );
}

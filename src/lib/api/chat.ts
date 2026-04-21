import { apiFetch, LoftlyAPIError } from './client';
import type { SelectorStackItem } from './types';

/**
 * POST /v1/selector/{session_id}/chat — follow-up Q&A on a cached Selector
 * result (POST_V1 §1, Tier A).
 *
 * Backend contract (PR-9 in loftly-api):
 *   - 200 → { answer_th, answer_en, category, cards_changed, new_stack?,
 *             rationale_diff_bullets[], remaining_questions }
 *   - 403 → email-gate not yet unlocked for an anon session that already
 *           exceeded the anon-chat budget. Client should trigger
 *           `MagicLinkPrompt` and let the user retry after magic-link consume.
 *   - 404 → unknown session (expired or never created)
 *   - 410 → session expired (24h TTL elapsed)
 *   - 429 → per-session 10-question cap hit (or `remaining_questions=0`
 *           returned alongside an otherwise 200 response — both paths render
 *           the same UX)
 *
 * No automatic retry: the LLM call already has server-side retry (§1 spec).
 * 20s timeout matches `submitSelector` — Haiku p95 is ~3s but allow headroom.
 */

export interface ChatRequest {
  question: string;
}

export type ChatCategory = 'explain' | 'what-if' | 'other';

export interface ChatResponse {
  answer_th: string;
  answer_en: string;
  category: ChatCategory;
  cards_changed: boolean;
  /** Populated only when `category === 'what-if' && cards_changed === true`. */
  new_stack: SelectorStackItem[] | null;
  /** Short bullets describing deltas vs the original stack (empty when not what-if). */
  rationale_diff_bullets: string[];
  remaining_questions: number;
}

export function postSelectorChat(
  sessionId: string,
  question: string,
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<ChatResponse> {
  const request: ChatRequest = { question };
  return apiFetch<ChatResponse>(
    `/selector/${encodeURIComponent(sessionId)}/chat`,
    {
      method: 'POST',
      body: request,
      accessToken: opts.accessToken ?? null,
      revalidate: false,
      signal: opts.signal,
      timeoutMs: 20_000,
      maxRetries: 0,
    },
  );
}

export { LoftlyAPIError };

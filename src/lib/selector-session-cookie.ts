/**
 * Recognition cookie for POST_V1 §3 returning-user landing.
 *
 * - Name: `loftly_selector_session` (deliberately distinct from `loftly_session`
 *   JWT to prevent collision).
 * - Body: JSON `{session_id: string, last_seen_at: ISO 8601 string}`.
 * - Attributes: `SameSite=Lax`, `Secure` (when served over HTTPS), `Path=/`,
 *   session-scoped (no `Max-Age` → cleared on browser close).
 * - `HttpOnly = false` — the client must read it to trigger personalized hero
 *   hydration. (`document.cookie` can't set `HttpOnly` anyway.)
 *
 * No PII. No card name. No profile hash. Only `session_id` + last-seen
 * timestamp, bound to the Optimization purpose the user already granted by
 * completing the Selector (`POST_V1.md §3 PDPA touchpoints`).
 */

export const COOKIE_NAME = 'loftly_selector_session';

export interface SelectorSessionCookie {
  session_id: string;
  last_seen_at: string;
}

export function writeSelectorSessionCookie(sessionId: string): void {
  if (typeof document === 'undefined') return; // SSR no-op
  const payload: SelectorSessionCookie = {
    session_id: sessionId,
    last_seen_at: new Date().toISOString(),
  };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  document.cookie = `${COOKIE_NAME}=${encoded}; Path=/; SameSite=Lax${secure}`;
}

export function readSelectorSessionCookie(): SelectorSessionCookie | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  try {
    const val = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1));
    const parsed = JSON.parse(val) as SelectorSessionCookie;
    if (
      typeof parsed.session_id !== 'string' ||
      typeof parsed.last_seen_at !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSelectorSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

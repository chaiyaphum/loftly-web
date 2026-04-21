'use client';

import { useEffect } from 'react';
import { writeSelectorSessionCookie } from '@/lib/selector-session-cookie';

/**
 * Client-only island that writes the POST_V1 §3 recognition cookie once the
 * Selector results page has rendered on the client. Renders no UI.
 *
 * Mounted from the server component `page.tsx` with the SSR-resolved
 * `sessionId`, so the cookie write is always keyed to the current session.
 */
export function SessionCookieWriter({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    writeSelectorSessionCookie(sessionId);
  }, [sessionId]);
  return null;
}

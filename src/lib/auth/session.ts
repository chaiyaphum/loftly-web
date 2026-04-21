/**
 * Server-side session cookie helpers.
 *
 * `loftly_session` — HTTP-only cookie set by `/auth/magic-link/consume` and
 * `/api/auth/oauth/callback` after a successful token exchange. Value is the
 * raw JWT access token (short-lived). `loftly_role` — non-httponly cookie
 * mirroring the user's role claim for UI gating; the server re-validates the
 * JWT on every request — cookie is not trusted for authorization.
 */

import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'loftly_session';
export const ROLE_COOKIE = 'loftly_role';
export const REFRESH_COOKIE = 'loftly_refresh';

export type UserRole = 'user' | 'admin';

export interface Session {
  accessToken: string;
  role: UserRole;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const role = (store.get(ROLE_COOKIE)?.value as UserRole) ?? 'user';
  return { accessToken: token, role };
}

export async function getAdminSession(): Promise<Session | null> {
  const sess = await getSession();
  if (!sess) return null;
  if (sess.role !== 'admin') return null;
  return sess;
}

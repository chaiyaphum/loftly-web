import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE,
  hashCode,
  isAllowlistedPath,
  isInviteGateActive,
  isKnownCode,
  readInviteEnv,
  signInvite,
  verifyInvite,
} from './src/lib/invite';

const intlMiddleware = createMiddleware(routing);

/**
 * Order of concerns:
 *   1. Soft-launch invite gate (W11 — capped at 100 users per OPEN_QUESTIONS.md Q5).
 *   2. next-intl locale routing (default: th at `/`, English at `/en/*`).
 *
 * The gate is disabled when the env is not configured, so local dev and preview
 * deploys without secrets behave as before.
 */
export default async function middleware(
  request: NextRequest,
): Promise<NextResponse | Response> {
  const env = readInviteEnv(process.env);
  const { pathname, searchParams } = request.nextUrl;

  if (isInviteGateActive(env) && !isAllowlistedPath(pathname)) {
    // Query-string accept path: visitor clicks emailed link.
    const qsCode = searchParams.get('invite');
    if (qsCode && isKnownCode(qsCode, env)) {
      const cookie = await signInvite(qsCode, env);
      const cleanUrl = new URL(request.nextUrl);
      cleanUrl.searchParams.delete('invite');
      const redirect = NextResponse.redirect(cleanUrl);
      redirect.cookies.set(INVITE_COOKIE, cookie, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: INVITE_COOKIE_MAX_AGE,
      });
      // Best-effort ops telemetry (hashed code, no PII, no user id).
      void fireInviteAcceptedOps(qsCode).catch(() => {});
      return redirect;
    }

    const cookieValue = request.cookies.get(INVITE_COOKIE)?.value;
    const verified = await verifyInvite(cookieValue, env);
    if (!verified.ok) {
      const target = new URL('/invite-required', request.nextUrl);
      const response = NextResponse.redirect(target, { status: 307 });
      // Clear stale cookie on failed verification (version bump / expiry).
      if (cookieValue && verified.reason !== 'missing') {
        response.cookies.delete(INVITE_COOKIE);
      }
      return response;
    }
  }

  return intlMiddleware(request);
}

/**
 * Posts a single `invite_accepted` event to PostHog's public capture endpoint.
 * This is ops-only telemetry (no user id, no PII — just the hashed code
 * handle), so it's intentionally independent of the PDPA analytics consent
 * flow, which governs user-scoped tracking.
 */
async function fireInviteAcceptedOps(code: string): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';
  const jti = await hashCode(code);
  const body = {
    api_key: key,
    event: 'invite_accepted',
    // Anonymous ops distinct_id — namespaced by the hashed code.
    distinct_id: `invite:${jti}`,
    properties: { code_hash: jti, source: 'middleware' },
    timestamp: new Date().toISOString(),
  };
  try {
    await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // Don't delay the redirect waiting on this.
      keepalive: true,
    });
  } catch {
    // Swallow — ops telemetry must never break the gate.
  }
}

export const config = {
  // Match all non-static, non-api paths (same matcher as before — the invite
  // gate's allowlist further excludes /api/invite + /invite-required).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

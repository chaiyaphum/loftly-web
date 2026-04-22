import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
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
} from './lib/invite';

const intlMiddleware = createMiddleware(routing);

/**
 * Flat-app-directory adapter for next-intl v3.
 *
 * `src/app/` has no `[locale]` segment — pages live directly at
 * `src/app/cards/page.tsx`, `src/app/selector/page.tsx`, etc. But next-intl's
 * middleware (see node_modules/next-intl/dist/esm/middleware/middleware.js)
 * always rewrites to a locale-prefixed path: `/` → `/th`, `/en/foo` → `/en/foo`.
 * With a flat directory, neither rewrite target exists as a Next.js route, so
 * every request 404s.
 *
 * Fix: after next-intl emits its rewrite, strip the locale prefix from the
 * rewrite target so the flat-app route matches. We preserve the
 * `X-NEXT-INTL-LOCALE` header next-intl set so `getRequestConfig` still
 * resolves the correct messages bundle.
 */
function stripLocalePrefix(pathname: string): {
  stripped: string;
  locale: (typeof routing.locales)[number] | null;
} {
  for (const locale of routing.locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix) {
      return { stripped: '/', locale };
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return { stripped: pathname.slice(prefix.length), locale };
    }
  }
  return { stripped: pathname, locale: null };
}

function adaptIntlResponse(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const rewriteTarget = response.headers.get('x-middleware-rewrite');
  if (!rewriteTarget) return response;

  let rewriteUrl: URL;
  try {
    rewriteUrl = new URL(rewriteTarget);
  } catch {
    return response;
  }
  const { stripped, locale } = stripLocalePrefix(rewriteUrl.pathname);
  if (!locale || stripped === rewriteUrl.pathname) return response;

  rewriteUrl.pathname = stripped;
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set('X-NEXT-INTL-LOCALE', locale);

  const rewritten = NextResponse.rewrite(rewriteUrl, {
    request: { headers: forwardHeaders },
  });
  // Preserve response-side headers (Set-Cookie for NEXT_LOCALE, Link, Vary…),
  // excluding the original rewrite target we're superseding.
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'x-middleware-rewrite') return;
    rewritten.headers.set(key, value);
  });
  return rewritten;
}

/**
 * Order of concerns:
 *   1. Soft-launch invite gate (W11 — capped at 100 users per OPEN_QUESTIONS.md Q5).
 *   2. next-intl locale routing (default: th at `/`, English at `/en/*`) +
 *      flat-directory rewrite adapter above.
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

  const intlResponse = intlMiddleware(request);
  return adaptIntlResponse(request, intlResponse);
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

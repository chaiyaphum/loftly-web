import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiFetch, LoftlyAPIError } from '@/lib/api/client';
import type { TokenPair } from '@/lib/api/types';
import {
  REFRESH_COOKIE,
  ROLE_COOKIE,
  SESSION_COOKIE,
} from '@/lib/auth/session';
import {
  getRedirectUri,
  isOAuthProvider,
} from '@/lib/auth/oauth-providers';

/**
 * `/api/auth/oauth/callback` — completes the OAuth round-trip:
 *
 * 1. Validates `state` against the `loftly_oauth_state` cookie (CSRF guard).
 * 2. Extracts `code` from the query/body.
 * 3. Calls `POST /v1/auth/oauth/callback` with `{ provider, code, redirect_uri }`.
 * 4. On 200, persists the access+refresh tokens as cookies and redirects to
 *    the originally-requested `next` (or `/selector/results/{session_id}`).
 * 5. On 503 `oauth_provider_unavailable`, redirects to
 *    `/onboarding?error=oauth_provider_unavailable`.
 */
export const runtime = 'nodejs';

async function readStateCookie(): Promise<{
  state: string;
  next: string;
  session_id: string | null;
  provider?: string;
} | null> {
  const store = await cookies();
  const raw = store.get('loftly_oauth_state')?.value;
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function onboardingError(origin: string, error: string): NextResponse {
  const url = new URL('/onboarding', origin);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  return handleCallback(request, new URL(request.url).searchParams);
}

export async function POST(request: Request) {
  // Apple uses form_post — read form data instead of query.
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') params.set(k, v);
  }
  return handleCallback(request, params);
}

async function handleCallback(request: Request, params: URLSearchParams) {
  const origin = new URL(request.url).origin;
  const code = params.get('code');
  const state = params.get('state');
  const providerErr = params.get('error');

  const cookieState = await readStateCookie();

  if (providerErr === 'provider_not_configured') {
    const resp = onboardingError(origin, 'oauth_provider_unavailable');
    resp.cookies.delete('loftly_oauth_state');
    return resp;
  }

  if (providerErr || !code || !state || !cookieState || cookieState.state !== state) {
    const resp = onboardingError(origin, 'oauth_failed');
    resp.cookies.delete('loftly_oauth_state');
    return resp;
  }

  // The state-cookie originally carried the provider name — or infer from the
  // query param (some providers don't echo state back verbatim).
  const provider = cookieState.provider ?? params.get('provider') ?? '';
  if (!isOAuthProvider(provider)) {
    return onboardingError(origin, 'oauth_failed');
  }

  const redirectUri = getRedirectUri(request);

  try {
    const pair = await apiFetch<TokenPair>('/auth/oauth/callback', {
      method: 'POST',
      body: {
        provider,
        code,
        redirect_uri: redirectUri,
        ...(cookieState.session_id
          ? { session_id: cookieState.session_id }
          : {}),
      },
      accessToken: null,
      revalidate: false,
      maxRetries: 0,
    });

    const target = cookieState.session_id
      ? new URL(`/selector/results/${cookieState.session_id}`, origin)
      : new URL(cookieState.next || '/selector', origin);
    const resp = NextResponse.redirect(target);

    const secure = process.env.NODE_ENV === 'production';
    resp.cookies.set(SESSION_COOKIE, pair.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: pair.expires_in,
      secure,
    });
    resp.cookies.set(REFRESH_COOKIE, pair.refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      secure,
    });
    if (pair.user) {
      resp.cookies.set(ROLE_COOKIE, pair.user.role, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: pair.expires_in,
        secure,
      });
    }
    resp.cookies.delete('loftly_oauth_state');
    return resp;
  } catch (err) {
    if (
      err instanceof LoftlyAPIError &&
      err.code === 'oauth_provider_unavailable'
    ) {
      const resp = onboardingError(origin, 'oauth_provider_unavailable');
      resp.cookies.delete('loftly_oauth_state');
      return resp;
    }
    const resp = onboardingError(origin, 'oauth_failed');
    resp.cookies.delete('loftly_oauth_state');
    return resp;
  }
}

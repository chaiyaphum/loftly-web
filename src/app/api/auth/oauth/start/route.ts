import { NextResponse } from 'next/server';
import {
  getProviderConfig,
  getRedirectUri,
  isOAuthProvider,
} from '@/lib/auth/oauth-providers';

/**
 * `/api/auth/oauth/start?provider=google|apple|line&next=/optional-path`
 *
 * Builds the provider's authorize URL and 302-redirects the user. State is a
 * random 32-char hex string — we stash it (plus optional `next` + `session_id`)
 * in a short-lived cookie so the callback route can validate CSRF without a
 * server-side session store.
 */
export const runtime = 'nodejs';

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? '';
  const next = url.searchParams.get('next') ?? '/selector';
  const sessionId = url.searchParams.get('session_id');

  if (!isOAuthProvider(provider)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_provider',
          message_en: 'Unknown provider',
          message_th: 'ผู้ให้บริการไม่ถูกต้อง',
        },
      },
      { status: 400 },
    );
  }

  const cfg = getProviderConfig(provider);
  const state = randomState();
  const redirectUri = getRedirectUri(request);

  const authUrl = new URL(cfg.authorizeUrl);
  if (cfg.clientId) {
    authUrl.searchParams.set('client_id', cfg.clientId);
  } else {
    // Stub / staging fallback — go straight to our callback with a canned
    // error so the UX path is testable without real credentials.
    const stubUrl = new URL(
      '/api/auth/oauth/callback',
      process.env.NEXT_PUBLIC_APP_URL || url.origin,
    );
    stubUrl.searchParams.set('provider', provider);
    stubUrl.searchParams.set('error', 'provider_not_configured');
    stubUrl.searchParams.set('state', state);
    const resp = NextResponse.redirect(stubUrl);
    setStateCookie(resp, state, next, sessionId);
    return resp;
  }
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', cfg.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  if (cfg.responseMode === 'form_post') {
    authUrl.searchParams.set('response_mode', 'form_post');
  }
  // Forward provider param so the callback route knows which provider to
  // tell the backend about (Google/LINE strip this from state).
  authUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authUrl);
  setStateCookie(response, state, next, sessionId, provider);
  return response;
}

function setStateCookie(
  resp: NextResponse,
  state: string,
  next: string,
  sessionId: string | null,
  provider?: string,
) {
  const payload = JSON.stringify({ state, next, session_id: sessionId, provider });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  resp.cookies.set('loftly_oauth_state', encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 min
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * OAuth provider descriptors — mirrors backend `/auth/oauth/callback` contract.
 *
 * For each provider we store the authorize endpoint + the env vars that hold
 * the client_id. When `_CLIENT_ID` env is absent, the provider still redirects
 * to its authorize endpoint for UX fidelity during staging; the backend will
 * respond with 503 `oauth_provider_unavailable` at callback time, and our
 * callback route surfaces that as a friendly error.
 *
 * Per `DEPLOYMENT.md`: credentials are env-var-gated so the build succeeds
 * without them — production deploy wires them via Cloudflare Pages secrets.
 */

export type OAuthProvider = 'google' | 'apple' | 'line';

export const OAUTH_PROVIDERS: OAuthProvider[] = ['google', 'apple', 'line'];

export interface ProviderConfig {
  authorizeUrl: string;
  clientId: string | null;
  scopes: string[];
  /** Apple requires `response_mode=form_post`; others use `query`. */
  responseMode: 'query' | 'form_post';
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  switch (provider) {
    case 'google':
      return {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId: process.env.GOOGLE_CLIENT_ID ?? null,
        scopes: ['openid', 'email', 'profile'],
        responseMode: 'query',
      };
    case 'apple':
      return {
        authorizeUrl: 'https://appleid.apple.com/auth/authorize',
        clientId: process.env.APPLE_CLIENT_ID ?? null,
        scopes: ['name', 'email'],
        responseMode: 'form_post',
      };
    case 'line':
      return {
        authorizeUrl: 'https://access.line.me/oauth2/v2.1/authorize',
        clientId: process.env.LINE_CLIENT_ID ?? null,
        scopes: ['profile', 'openid', 'email'],
        responseMode: 'query',
      };
  }
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as string[]).includes(value);
}

export function getRedirectUri(request: Request): string {
  // Prefer the configured origin; fall back to the request origin so Preview
  // URLs (Cloudflare Pages) still work without additional env vars.
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return `${configured.replace(/\/$/, '')}/api/auth/oauth/callback`;
  }
  const u = new URL(request.url);
  return `${u.origin}/api/auth/oauth/callback`;
}

/**
 * Edge-runtime invite-code gate helpers (Web Crypto, no node:crypto).
 *
 * Soft-launch gate per mvp/DEV_PLAN.md W11 + mvp/OPEN_QUESTIONS.md Q5.
 *
 * Cookie layout:
 *   loftly_invite = <base64url(payload)>.<base64url(hmac)>
 * where payload = {"v":<version>,"exp":<unix-ms>,"jti":"<first-8-of-sha256(code)>"}.
 *
 * Version bumps via LOFTLY_INVITE_COOKIE_VERSION invalidate all previously
 * issued cookies without touching the secret (used when revoking codes).
 */
export const INVITE_COOKIE = 'loftly_invite';

/** 30 days in seconds. */
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface InvitePayload {
  /** Cookie schema + invalidation version (reads LOFTLY_INVITE_COOKIE_VERSION). */
  v: number;
  /** Expiry as unix-ms. */
  exp: number;
  /** First 8 hex chars of SHA-256(code). Non-PII tracking handle. */
  jti: string;
}

export interface InviteEnv {
  secret: string;
  codes: string[];
  version: number;
}

/**
 * Pulls invite config from process.env with safe defaults. In dev without env,
 * the gate is a no-op (codes array empty, secret missing → gate disabled).
 */
export function readInviteEnv(env: NodeJS.ProcessEnv = process.env): InviteEnv {
  const secret = env.LOFTLY_INVITE_SECRET ?? '';
  const version = Number.parseInt(env.LOFTLY_INVITE_COOKIE_VERSION ?? '1', 10);
  let codes: string[] = [];
  const raw = env.LOFTLY_INVITE_CODES ?? '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        codes = parsed.filter((c): c is string => typeof c === 'string' && c.length > 0);
      }
    } catch {
      // Accept comma-separated fallback for ops convenience.
      codes = raw
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    }
  }
  return { secret, codes: codes.map((c) => c.trim()), version: Number.isFinite(version) ? version : 1 };
}

/** Gate is active only when both a secret and at least one code are configured. */
export function isInviteGateActive(env: InviteEnv): boolean {
  return env.secret.length > 0 && env.codes.length > 0;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa is available in both edge runtime and Node 18+.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(sig);
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Public: first 8 hex of SHA-256(code) — used as the non-PII code handle. */
export async function hashCode(code: string): Promise<string> {
  const hex = await sha256Hex(code);
  return hex.slice(0, 8);
}

/** Constant-time-ish string equality (avoids short-circuit based on mismatch). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Signs a fresh invite cookie for `code` valid for `INVITE_COOKIE_MAX_AGE`
 * seconds. Throws when the gate is not configured.
 */
export async function signInvite(
  code: string,
  env: InviteEnv,
  now: number = Date.now(),
): Promise<string> {
  if (!env.secret) throw new Error('LOFTLY_INVITE_SECRET not configured');
  const payload: InvitePayload = {
    v: env.version,
    exp: now + INVITE_COOKIE_MAX_AGE * 1000,
    jti: await hashCode(code),
  };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const mac = await hmacSha256(env.secret, payloadB64);
  return `${payloadB64}.${toBase64Url(mac)}`;
}

export type InviteVerifyFailure =
  | 'missing'
  | 'malformed'
  | 'bad-signature'
  | 'version-mismatch'
  | 'expired';

export interface InviteVerifyResult {
  ok: boolean;
  reason?: InviteVerifyFailure;
  payload?: InvitePayload;
}

/**
 * Verifies a cookie value against the current env config. Fails closed on
 * any mismatch — version, signature, or expiry.
 */
export async function verifyInvite(
  cookie: string | undefined | null,
  env: InviteEnv,
  now: number = Date.now(),
): Promise<InviteVerifyResult> {
  if (!cookie) return { ok: false, reason: 'missing' };
  if (!env.secret) return { ok: false, reason: 'missing' };
  const parts = cookie.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payloadB64, macB64] = parts as [string, string];

  let payload: InvitePayload;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payloadB64));
    payload = JSON.parse(json) as InvitePayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const expected = await hmacSha256(env.secret, payloadB64);
  const expectedB64 = toBase64Url(expected);
  if (!safeEqual(expectedB64, macB64)) {
    return { ok: false, reason: 'bad-signature' };
  }

  if (payload.v !== env.version) {
    return { ok: false, reason: 'version-mismatch' };
  }
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}

/** Does `code` appear in the configured allowlist? Case-sensitive. */
export function isKnownCode(code: string, env: InviteEnv): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  return env.codes.some((c) => safeEqual(c, trimmed));
}

/** Paths that bypass the gate entirely. */
export const INVITE_ALLOWLIST_PATHS: readonly RegExp[] = [
  /^\/_next(\/|$)/,
  /^\/api\/invite(\/|$)/,
  /^\/invite-required(\/|$)/,
  /^\/(th|en)\/invite-required(\/|$)/,
  /^\/legal(\/|$)/,
  /^\/(th|en)\/legal(\/|$)/,
  /^\/healthz$/,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

export function isAllowlistedPath(pathname: string): boolean {
  return INVITE_ALLOWLIST_PATHS.some((re) => re.test(pathname));
}

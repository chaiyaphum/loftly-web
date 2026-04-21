import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  INVITE_COOKIE,
  hashCode,
  isAllowlistedPath,
  isInviteGateActive,
  isKnownCode,
  readInviteEnv,
  signInvite,
  verifyInvite,
} from '@/lib/invite';

/**
 * Unit tests for the edge-runtime invite gate.
 *
 * Scope:
 *   - env parsing (JSON + CSV fallback + gate-off semantics)
 *   - sign/verify round-trip
 *   - failure modes: missing / malformed / bad signature / version mismatch /
 *     expired
 *   - path allowlist
 *   - middleware behaviour: valid cookie → pass-through, invalid → 307 to
 *     /invite-required, ?invite=<code> → redirect + Set-Cookie
 */

const SECRET = '0'.repeat(64);

function makeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    LOFTLY_INVITE_SECRET: SECRET,
    LOFTLY_INVITE_CODES: JSON.stringify(['AAAA1111', 'BBBB2222']),
    LOFTLY_INVITE_COOKIE_VERSION: '1',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe('readInviteEnv', () => {
  it('parses JSON array of codes', () => {
    const env = readInviteEnv(makeEnv());
    expect(env.codes).toEqual(['AAAA1111', 'BBBB2222']);
    expect(env.version).toBe(1);
    expect(env.secret).toBe(SECRET);
  });

  it('falls back to CSV when JSON parse fails', () => {
    const env = readInviteEnv(makeEnv({ LOFTLY_INVITE_CODES: 'X1,Y2 , Z3' }));
    expect(env.codes).toEqual(['X1', 'Y2', 'Z3']);
  });

  it('treats empty config as gate-off', () => {
    const env = readInviteEnv({} as NodeJS.ProcessEnv);
    expect(isInviteGateActive(env)).toBe(false);
  });

  it('requires both secret and at least one code to activate', () => {
    expect(
      isInviteGateActive(readInviteEnv(makeEnv({ LOFTLY_INVITE_SECRET: '' }))),
    ).toBe(false);
    expect(
      isInviteGateActive(
        readInviteEnv(makeEnv({ LOFTLY_INVITE_CODES: '[]' })),
      ),
    ).toBe(false);
    expect(isInviteGateActive(readInviteEnv(makeEnv()))).toBe(true);
  });
});

describe('isAllowlistedPath', () => {
  it.each([
    ['/_next/static/chunk.js', true],
    ['/api/invite', true],
    ['/invite-required', true],
    ['/en/invite-required', true],
    ['/legal/privacy', true],
    ['/en/legal/terms', true],
    ['/favicon.ico', true],
    ['/robots.txt', true],
    ['/sitemap.xml', true],
    ['/healthz', true],
    ['/', false],
    ['/selector', false],
    ['/cards', false],
    ['/en/cards', false],
  ])('%s → allowlisted=%s', (path, expected) => {
    expect(isAllowlistedPath(path)).toBe(expected);
  });
});

describe('isKnownCode', () => {
  it('is case-sensitive and trims whitespace from input', () => {
    const env = readInviteEnv(makeEnv());
    expect(isKnownCode('AAAA1111', env)).toBe(true);
    expect(isKnownCode('  AAAA1111  ', env)).toBe(true);
    expect(isKnownCode('aaaa1111', env)).toBe(false);
    expect(isKnownCode('ZZZZ9999', env)).toBe(false);
    expect(isKnownCode('', env)).toBe(false);
  });
});

describe('signInvite / verifyInvite', () => {
  it('round-trips a signed cookie', async () => {
    const env = readInviteEnv(makeEnv());
    const cookie = await signInvite('AAAA1111', env);
    const result = await verifyInvite(cookie, env);
    expect(result.ok).toBe(true);
    expect(result.payload?.v).toBe(1);
    expect(result.payload?.jti).toBe(await hashCode('AAAA1111'));
  });

  it('rejects a missing cookie', async () => {
    const env = readInviteEnv(makeEnv());
    expect((await verifyInvite(undefined, env)).reason).toBe('missing');
    expect((await verifyInvite('', env)).reason).toBe('missing');
  });

  it('rejects malformed cookies', async () => {
    const env = readInviteEnv(makeEnv());
    expect((await verifyInvite('not-a-cookie', env)).reason).toBe('malformed');
    expect((await verifyInvite('a.b.c', env)).reason).toBe('malformed');
    expect((await verifyInvite('@@@.###', env)).reason).toBe('malformed');
  });

  it('rejects a cookie signed with a different secret', async () => {
    const good = readInviteEnv(makeEnv());
    const attacker = readInviteEnv(makeEnv({ LOFTLY_INVITE_SECRET: '1'.repeat(64) }));
    const cookie = await signInvite('AAAA1111', attacker);
    expect((await verifyInvite(cookie, good)).reason).toBe('bad-signature');
  });

  it('rejects a cookie after the version is bumped', async () => {
    const env = readInviteEnv(makeEnv());
    const cookie = await signInvite('AAAA1111', env);
    const bumped = readInviteEnv(makeEnv({ LOFTLY_INVITE_COOKIE_VERSION: '2' }));
    const result = await verifyInvite(cookie, bumped);
    expect(result.reason).toBe('version-mismatch');
  });

  it('rejects an expired cookie', async () => {
    const env = readInviteEnv(makeEnv());
    // Sign at t=0, verify at t=well past expiry.
    const cookie = await signInvite('AAAA1111', env, 0);
    const later = Date.now() + 1_000_000;
    expect((await verifyInvite(cookie, env, later)).reason).toBe('expired');
  });
});

describe('middleware — gate semantics', () => {
  // Import lazily so module-level env reads don't cache before we set them.
  let middleware: typeof import('../middleware').default;

  async function load() {
    vi.resetModules();
    middleware = (await import('../middleware')).default;
  }

  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env.LOFTLY_INVITE_SECRET = SECRET;
    process.env.LOFTLY_INVITE_CODES = JSON.stringify(['AAAA1111']);
    process.env.LOFTLY_INVITE_COOKIE_VERSION = '1';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function buildRequest(url: string, cookieHeader?: string) {
    const { NextRequest } = await import('next/server');
    return new NextRequest(new URL(url), {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
  }

  it('redirects unauthenticated requests to /invite-required', async () => {
    await load();
    const req = await buildRequest('https://loftly.biggo-analytics.dev/selector');
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('/invite-required');
  });

  it('accepts ?invite=<valid-code> and sets the cookie', async () => {
    await load();
    const req = await buildRequest('https://loftly.biggo-analytics.dev/?invite=AAAA1111');
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${INVITE_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
    // Redirect strips the invite query.
    expect(res.headers.get('location')).not.toContain('invite=');
  });

  it('ignores ?invite=<unknown> and redirects to /invite-required', async () => {
    await load();
    const req = await buildRequest('https://loftly.biggo-analytics.dev/?invite=ZZZZ9999');
    const res = await middleware(req);
    expect(res.headers.get('location')).toContain('/invite-required');
    expect(res.headers.get('set-cookie') ?? '').not.toContain(`${INVITE_COOKIE}=`);
  });

  it('passes through when a valid cookie is presented', async () => {
    await load();
    const { readInviteEnv, signInvite } = await import('@/lib/invite');
    const env = readInviteEnv(process.env);
    const cookie = await signInvite('AAAA1111', env);
    const req = await buildRequest(
      'https://loftly.biggo-analytics.dev/cards',
      `${INVITE_COOKIE}=${cookie}`,
    );
    const res = await middleware(req);
    // next-intl middleware does NOT redirect when already inside the locale
    // path; a pass-through produces 200 or a rewrite header rather than 30x to
    // /invite-required.
    expect(res.headers.get('location') ?? '').not.toContain('/invite-required');
  });

  it('redirects when the cookie signature is forged', async () => {
    await load();
    const forged = 'ZmFrZQ.ZmFrZS1tYWM';
    const req = await buildRequest(
      'https://loftly.biggo-analytics.dev/selector',
      `${INVITE_COOKIE}=${forged}`,
    );
    const res = await middleware(req);
    expect(res.headers.get('location')).toContain('/invite-required');
  });

  it('is disabled when the env is not configured', async () => {
    delete process.env.LOFTLY_INVITE_SECRET;
    delete process.env.LOFTLY_INVITE_CODES;
    await load();
    const req = await buildRequest('https://loftly.biggo-analytics.dev/selector');
    const res = await middleware(req);
    expect(res.headers.get('location') ?? '').not.toContain('/invite-required');
  });

  it('allows /invite-required through without a cookie', async () => {
    await load();
    const req = await buildRequest('https://loftly.biggo-analytics.dev/invite-required');
    const res = await middleware(req);
    expect(res.headers.get('location') ?? '').not.toContain('/invite-required?');
  });
});

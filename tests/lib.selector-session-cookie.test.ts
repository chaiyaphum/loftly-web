import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COOKIE_NAME,
  clearSelectorSessionCookie,
  readSelectorSessionCookie,
  writeSelectorSessionCookie,
} from '@/lib/selector-session-cookie';

/**
 * jsdom's `document.cookie` mirrors browser semantics: assigning a single
 * cookie string appends/updates one entry, and attributes like `Path` /
 * `SameSite` / `Max-Age=0` are interpreted correctly. `HttpOnly` and `Secure`
 * attributes don't round-trip on read (document.cookie never surfaces them
 * on either platform), which is why we assert on the write string captured
 * via a `document.cookie` setter spy for those attributes.
 */

function wipeAllCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const eq = pair.indexOf('=');
    const name = (eq >= 0 ? pair.slice(0, eq) : pair).trim();
    if (name) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }
}

describe('selector-session-cookie', () => {
  beforeEach(() => {
    wipeAllCookies();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    wipeAllCookies();
  });

  it('write then read returns the same session_id', () => {
    writeSelectorSessionCookie('sess_abc123');
    const parsed = readSelectorSessionCookie();
    expect(parsed).not.toBeNull();
    expect(parsed!.session_id).toBe('sess_abc123');
    // ISO 8601 — parseable and round-trips through Date
    expect(Number.isNaN(Date.parse(parsed!.last_seen_at))).toBe(false);
  });

  it('read with no cookie returns null', () => {
    expect(readSelectorSessionCookie()).toBeNull();
  });

  it('read with malformed JSON returns null without throwing', () => {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent('not-json-{')}; Path=/; SameSite=Lax`;
    expect(() => readSelectorSessionCookie()).not.toThrow();
    expect(readSelectorSessionCookie()).toBeNull();
  });

  it('read with wrong-shape JSON (missing fields) returns null', () => {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ foo: 'bar' }))}; Path=/; SameSite=Lax`;
    expect(readSelectorSessionCookie()).toBeNull();
  });

  it('write + clear → read returns null', () => {
    writeSelectorSessionCookie('sess_to_clear');
    expect(readSelectorSessionCookie()).not.toBeNull();
    clearSelectorSessionCookie();
    expect(readSelectorSessionCookie()).toBeNull();
  });

  it('cookie attributes include Path=/ and SameSite=Lax on write', () => {
    const writes: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'cookie',
    );
    // Some jsdom builds put the descriptor on the instance instead of the
    // prototype. Fall back to HTMLDocument / document itself.
    const target =
      descriptor ??
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(document),
        'cookie',
      ) ??
      Object.getOwnPropertyDescriptor(document, 'cookie');
    expect(target).toBeDefined();
    const originalSet = target!.set!.bind(document);
    const originalGet = target!.get!.bind(document);
    const spy = vi
      .spyOn(document, 'cookie', 'set')
      .mockImplementation((v: string) => {
        writes.push(v);
        originalSet(v);
      });
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() =>
      originalGet(),
    );

    writeSelectorSessionCookie('sess_attrs');
    const lastWrite = writes[writes.length - 1];
    expect(lastWrite).toContain(`${COOKIE_NAME}=`);
    expect(lastWrite).toContain('Path=/');
    expect(lastWrite).toContain('SameSite=Lax');
    // Session-scoped: no Max-Age, no Expires
    expect(lastWrite).not.toMatch(/Max-Age=/i);
    expect(lastWrite).not.toMatch(/Expires=/i);
    // HttpOnly can never be set via document.cookie — confirm we don't try
    expect(lastWrite).not.toMatch(/HttpOnly/i);

    spy.mockRestore();
  });

  it('Secure attribute omitted on http and present on https', () => {
    const writes: string[] = [];
    const spy = vi
      .spyOn(document, 'cookie', 'set')
      .mockImplementation((v: string) => {
        writes.push(v);
      });

    // Default jsdom origin is http://localhost — Secure should be absent
    writeSelectorSessionCookie('sess_http');
    expect(writes[writes.length - 1]).not.toMatch(/;\s*Secure/);

    // jsdom guards `window.location` against direct redefinition. Swap the
    // whole property via Object.defineProperty on `window` instead — this is
    // the same pattern the Next.js team uses in its own jsdom tests.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, protocol: 'https:' },
    });
    writeSelectorSessionCookie('sess_https');
    expect(writes[writes.length - 1]).toMatch(/;\s*Secure/);

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    spy.mockRestore();
  });

  it('SSR simulation: write/read/clear are no-ops without document', async () => {
    vi.resetModules();
    const originalDocument = globalThis.document;
    // Simulate Node SSR where `document` is undefined.
    delete (globalThis as { document?: Document }).document;

    const mod = await import('@/lib/selector-session-cookie');
    expect(() => mod.writeSelectorSessionCookie('sess_ssr')).not.toThrow();
    expect(mod.readSelectorSessionCookie()).toBeNull();
    expect(() => mod.clearSelectorSessionCookie()).not.toThrow();

    (globalThis as { document?: Document }).document = originalDocument;
  });

  it('coexists with loftly_session JWT — no collision on set/read', () => {
    // Simulate the JWT cookie already being set by /auth/magic-link/consume
    document.cookie = 'loftly_session=jwt.eyJzdWIiOiJ1XzEyMyJ9.sig; Path=/; SameSite=Lax';

    writeSelectorSessionCookie('sess_coexist_xyz');

    // Both cookies must be present and independently readable.
    const raw = document.cookie;
    expect(raw).toContain('loftly_session=jwt.eyJzdWIiOiJ1XzEyMyJ9.sig');
    expect(raw).toContain(`${COOKIE_NAME}=`);

    const parsed = readSelectorSessionCookie();
    expect(parsed).not.toBeNull();
    expect(parsed!.session_id).toBe('sess_coexist_xyz');

    // Critical collision assertion — reader must not match the JWT cookie
    // just because it shares the `loftly_` prefix.
    const jwtMatch = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('loftly_session='));
    expect(jwtMatch).toBe('loftly_session=jwt.eyJzdWIiOiJ1XzEyMyJ9.sig');
    expect(parsed!.session_id).not.toContain('jwt');

    // Clearing the recognition cookie must NOT nuke the JWT.
    clearSelectorSessionCookie();
    expect(readSelectorSessionCookie()).toBeNull();
    expect(document.cookie).toContain('loftly_session=jwt.eyJzdWIiOiJ1XzEyMyJ9.sig');
  });
});

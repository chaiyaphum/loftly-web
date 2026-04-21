import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit tests for `src/app/sitemap.ts` + `src/app/robots.ts`.
 *
 * The sitemap route is a thin orchestrator — these tests stub `fetch` and
 * verify the composed `MetadataRoute.Sitemap` shape, including static-only
 * fallback behaviour when the upstream API 5xxs.
 */

const originalFetch = globalThis.fetch;

function makeResponse(
  status: number,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    status,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function stubFetchByPath(handlers: Record<string, Response | Error>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [fragment, value] of Object.entries(handlers)) {
      if (url.includes(fragment)) {
        if (value instanceof Error) throw value;
        // Clone so each test can reuse the same Response template if needed.
        return value.clone();
      }
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = 'http://api.test/v1';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
  vi.resetModules();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('sitemap', () => {
  it('includes all 8 static routes even when the API returns empty lists', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles?type=card_review': makeResponse(200, { data: [] }),
      '/articles?type=guide': makeResponse(200, { data: [] }),
      '/valuations': makeResponse(200, { data: [] }),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://site.test/',
        'https://site.test/cards',
        'https://site.test/selector',
        'https://site.test/valuations',
        'https://site.test/pricing',
        'https://site.test/legal/privacy',
        'https://site.test/legal/terms',
        'https://site.test/legal/affiliate-disclosure',
      ]),
    );
    expect(entries).toHaveLength(8);
  });

  it('populates dynamic routes from the three API buckets', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles?type=card_review': makeResponse(200, {
        data: [
          {
            slug: 'kbank-the-one-review',
            card_slug: 'kbank-the-one',
            published_at: '2026-04-10T00:00:00Z',
            updated_at: '2026-04-15T00:00:00Z',
          },
        ],
      }),
      '/articles?type=guide': makeResponse(200, {
        data: [
          {
            slug: 'thai-miles-starter',
            updated_at: '2026-03-01T00:00:00Z',
          },
        ],
      }),
      '/valuations': makeResponse(200, {
        data: [
          {
            currency: { code: 'ROP' },
            computed_at: '2026-04-12T00:00:00Z',
          },
          {
            currency: { code: 'KRIS' },
            computed_at: '2026-04-11T00:00:00Z',
          },
        ],
      }),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain('https://site.test/cards/kbank-the-one');
    expect(urls).toContain('https://site.test/guides/thai-miles-starter');
    expect(urls).toContain('https://site.test/valuations/ROP');
    expect(urls).toContain('https://site.test/valuations/KRIS');
    // 8 static + 1 card + 1 guide + 2 valuations = 12
    expect(entries).toHaveLength(12);
  });

  it('prefers updated_at over published_at/computed_at for lastModified', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles?type=card_review': makeResponse(200, {
        data: [
          {
            slug: 'card-a-review',
            card_slug: 'card-a',
            published_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-04-01T00:00:00Z',
          },
        ],
      }),
      '/articles?type=guide': makeResponse(200, { data: [] }),
      '/valuations': makeResponse(200, { data: [] }),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    const cardEntry = entries.find((e) =>
      e.url.endsWith('/cards/card-a'),
    );
    expect(cardEntry?.lastModified).toEqual(new Date('2026-04-01T00:00:00Z'));
  });

  it('falls back to static-only when every dynamic fetch fails (5xx)', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles?type=card_review': makeResponse(500, { error: { code: 'x', message_en: 'boom' } }),
      '/articles?type=guide': makeResponse(503, { error: { code: 'x', message_en: 'boom' } }),
      '/valuations': makeResponse(500, { error: { code: 'x', message_en: 'boom' } }),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    // Static routes only, no dynamic rows.
    expect(entries).toHaveLength(8);
    expect(entries.every((e) => !e.url.includes('/cards/'))).toBe(true);
    expect(entries.every((e) => !e.url.includes('/guides/'))).toBe(true);
    // `/valuations` (index) is still present, but no `/valuations/<code>`.
    expect(
      entries.filter((e) => /\/valuations\/[^/]+$/.test(e.url)),
    ).toHaveLength(0);
  });

  it('falls back to static-only when fetch throws a network error', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles': new Error('ECONNREFUSED'),
      '/valuations': new Error('ECONNREFUSED'),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    expect(entries).toHaveLength(8);
  });

  it('uses card_slug for the /cards/[slug] URL when present', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles?type=card_review': makeResponse(200, {
        data: [
          {
            slug: 'my-article-slug',
            card_slug: 'ktc-x-infinite',
          },
        ],
      }),
      '/articles?type=guide': makeResponse(200, { data: [] }),
      '/valuations': makeResponse(200, { data: [] }),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://site.test/cards/ktc-x-infinite');
    expect(urls).not.toContain('https://site.test/cards/my-article-slug');
  });

  it('assigns the documented priorities to each surface', async () => {
    globalThis.fetch = stubFetchByPath({
      '/articles?type=card_review': makeResponse(200, {
        data: [{ slug: 'a', card_slug: 'a' }],
      }),
      '/articles?type=guide': makeResponse(200, {
        data: [{ slug: 'g' }],
      }),
      '/valuations': makeResponse(200, {
        data: [{ currency: { code: 'KRIS' } }],
      }),
    });
    const { default: sitemap } = await import('./sitemap');
    const entries = await sitemap();
    const byUrl = Object.fromEntries(entries.map((e) => [e.url, e.priority]));
    expect(byUrl['https://site.test/']).toBe(1.0);
    expect(byUrl['https://site.test/cards/a']).toBe(0.8);
    expect(byUrl['https://site.test/selector']).toBe(0.7);
    expect(byUrl['https://site.test/valuations/KRIS']).toBe(0.7);
    expect(byUrl['https://site.test/guides/g']).toBe(0.6);
    expect(byUrl['https://site.test/legal/privacy']).toBe(0.3);
  });
});

describe('robots', () => {
  it('allows `/`, disallows admin/account/api/onboarding/invite/session paths', async () => {
    const { default: robots } = await import('./robots');
    const output = robots();
    const rules = Array.isArray(output.rules) ? output.rules : [output.rules];
    const rule = rules[0];
    if (!rule) throw new Error('robots() returned no rules');
    expect(rule.userAgent).toBe('*');
    expect(rule.allow).toBe('/');
    const disallow = Array.isArray(rule.disallow)
      ? rule.disallow
      : rule.disallow
        ? [rule.disallow]
        : [];
    expect(disallow).toEqual(
      expect.arrayContaining([
        '/admin/*',
        '/account/*',
        '/api/*',
        '/onboarding',
        '/invite-required',
        '/selector/results/*',
      ]),
    );
  });

  it('points sitemap at the configured site URL', async () => {
    const { default: robots } = await import('./robots');
    const output = robots();
    expect(output.sitemap).toBe('https://site.test/sitemap.xml');
    expect(output.host).toBe('site.test');
  });

  it('falls back to the staging host when NEXT_PUBLIC_SITE_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    vi.resetModules();
    const { default: robots } = await import('./robots');
    const output = robots();
    expect(output.sitemap).toBe('https://loftly.biggo-analytics.dev/sitemap.xml');
    expect(output.host).toBe('loftly.biggo-analytics.dev');
  });
});

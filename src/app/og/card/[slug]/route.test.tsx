import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-handler tests for `/og/card/[slug]`.
 *
 * Strategy:
 *   - Mock `fetch` with a table of responses keyed by pathname suffix — one
 *     entry for the card endpoint, one for the valuation endpoint.
 *   - Import the route module *after* the mock is installed so the Edge-side
 *     `fetch` picked up inside `route.tsx` is the mocked one.
 *   - Assert status, Content-Type (`image/png`), and the `Cache-Control`
 *     headers mandated by PR #23.
 *
 * We can't easily introspect the rendered pixels in jsdom, but `next/og`
 * produces a `Response` with `Content-Type: image/png` — that plus the
 * status + headers is the public contract we care about.
 */

const CARD_FIXTURE = {
  id: 'card_01',
  slug: 'kbank-the-one',
  display_name: 'KBank The One',
  bank: {
    slug: 'kbank',
    display_name_en: 'KBank',
    display_name_th: 'ธ.กสิกรไทย',
  },
  tier: 'Platinum',
  network: 'Visa',
  annual_fee_thb: 2000,
  earn_currency: {
    code: 'KPOINT',
    display_name_en: 'KBank Reward Points',
    display_name_th: 'คะแนนกสิกร',
    currency_type: 'bank_proprietary',
  },
  earn_rate_local: { default: 1 },
  benefits: {},
  status: 'active',
};

const VALUATION_FIXTURE = {
  currency: CARD_FIXTURE.earn_currency,
  thb_per_point: 0.25,
  methodology: '80th-percentile',
  percentile: 0.8,
  sample_size: 120,
  confidence: 0.72,
  computed_at: '2026-01-01T00:00:00Z',
};

function installFetchMock(
  responses: Record<string, { ok: boolean; status: number; body: unknown }>,
): void {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const match = Object.entries(responses).find(([suffix]) =>
      url.includes(suffix),
    );
    if (!match) {
      return new Response('not stubbed', { status: 500 });
    }
    const [, { ok, status, body }] = match;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
      statusText: ok ? 'OK' : 'ERROR',
    });
  });
  globalThis.fetch = spy as unknown as typeof fetch;
}

async function loadRoute() {
  vi.resetModules();
  return await import('./route');
}

function buildContext(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE = 'http://localhost:8000/v1';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_API_BASE;
});

describe('GET /og/card/[slug]', () => {
  it('returns 200 + image/png when the card exists', async () => {
    installFetchMock({
      '/cards/kbank-the-one': { ok: true, status: 200, body: CARD_FIXTURE },
      '/valuations/KPOINT': { ok: true, status: 200, body: VALUATION_FIXTURE },
    });

    const { GET } = await loadRoute();
    const res = await GET(new Request('https://example.com/og/card/kbank-the-one'), buildContext('kbank-the-one'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/i);
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    );
  });

  it('falls back to the "Card not found" image on 404', async () => {
    installFetchMock({
      '/cards/does-not-exist': {
        ok: false,
        status: 404,
        body: { error: { code: 'not_found', message_en: 'Not found' } },
      },
    });

    const { GET } = await loadRoute();
    const res = await GET(
      new Request('https://example.com/og/card/does-not-exist'),
      buildContext('does-not-exist'),
    );

    // Fallback image still renders a 200 PNG — the *image* says "not found",
    // but the HTTP response is successful so social scrapers accept it.
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/i);
    expect(res.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    );
  });

  it('falls back when the upstream API throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;

    const { GET } = await loadRoute();
    const res = await GET(
      new Request('https://example.com/og/card/any'),
      buildContext('any'),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/i);
  });

  it('still renders the card image when the valuation lookup fails', async () => {
    installFetchMock({
      '/cards/kbank-the-one': { ok: true, status: 200, body: CARD_FIXTURE },
      '/valuations/KPOINT': {
        ok: false,
        status: 500,
        body: { error: { code: 'server_error', message_en: 'boom' } },
      },
    });

    const { GET } = await loadRoute();
    const res = await GET(
      new Request('https://example.com/og/card/kbank-the-one'),
      buildContext('kbank-the-one'),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/i);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../messages/th.json';

/**
 * Landing page — "Latest reviews" + "Latest valuations" SSR wiring.
 *
 * Mocks mirror the pattern used by `tests/app.valuations.test.tsx` since
 * both suites render async React Server Components with `next-intl`
 * translations pulled from `th.json`.
 */

vi.mock('next-intl/server', () => ({
  getTranslations: async (scope: string) => makeT(scope),
  getLocale: async () => 'th',
}));

// Mock the post-positioning-shift hero/strip components so these tests stay
// focused on the "latest reviews + latest valuations" SSR wiring — they don't
// need to re-exercise LivePromoStrip freshness math or DualHero layout.
vi.mock('@/components/landing/LivePromoStrip', () => ({
  LivePromoStrip: () => null,
}));
vi.mock('@/components/landing/DualHero', () => ({
  DualHero: () => null,
}));
vi.mock('@/components/landing/TopPromosCarousel', () => ({
  TopPromosCarousel: () => null,
}));
vi.mock('@/components/landing/TopMerchantsGrid', () => ({
  TopMerchantsGrid: () => null,
}));
vi.mock('@/components/landing/SelectorCtaBlock', () => ({
  SelectorCtaBlock: () => null,
}));
vi.mock('@/components/landing/WhyLoftly', () => ({
  WhyLoftly: () => null,
}));

function makeT(scope: string) {
  const dict = thMessages as unknown as Record<string, unknown>;
  const segments = scope.split('.');
  let node: unknown = dict;
  for (const seg of segments) {
    node = (node as Record<string, unknown>)?.[seg];
  }
  const t = (key: string) => {
    const parts = key.split('.');
    let value: unknown = node;
    for (const p of parts) {
      value = (value as Record<string, unknown>)?.[p];
    }
    return typeof value === 'string' ? value : key;
  };
  t.raw = (key: string) => {
    const parts = key.split('.');
    let value: unknown = node;
    for (const p of parts) {
      value = (value as Record<string, unknown>)?.[p];
    }
    return value;
  };
  return t;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

async function renderAsync(node: Promise<React.ReactNode>) {
  const resolved = await node;
  return render(wrap(resolved));
}

const sampleArticle = (
  i: number,
  overrides: Partial<{ slug: string; title_th: string; summary_th: string }> = {},
) => ({
  id: `art-${i}`,
  slug: overrides.slug ?? `review-${i}`,
  card_id: `card-${i}`,
  card_slug: `card-${i}`,
  article_type: 'card_review' as const,
  title_th: overrides.title_th ?? `บัตรรีวิวที่ ${i}`,
  summary_th: overrides.summary_th ?? `สรุปรีวิวที่ ${i}`,
  body_th: '',
  state: 'published' as const,
  policy_version: '1.0',
  published_at: `2026-04-${10 + i}T00:00:00Z`,
  updated_at: `2026-04-${10 + i}T00:00:00Z`,
  best_for_tags: [],
});

const sampleValuation = (
  i: number,
  overrides: Partial<{ code: string; confidence: number }> = {},
) => ({
  currency: {
    code: overrides.code ?? `CUR${i}`,
    display_name_en: `Currency ${i}`,
    display_name_th: `สกุล ${i}`,
    currency_type: 'airline' as const,
  },
  thb_per_point: 0.9,
  methodology: 'percentile_80',
  percentile: 80,
  sample_size: 30,
  confidence: overrides.confidence ?? 0.8,
  top_redemption_example: null,
  computed_at: `2026-04-${10 + i}T00:00:00Z`,
});

const ARTICLES_URL_FRAGMENT = '/articles?type=card_review';
const VALUATIONS_URL_FRAGMENT = '/valuations?limit=5';

function installFetchMock(
  routes: {
    articles?: Response | (() => Response | Promise<Response>);
    valuations?: Response | (() => Response | Promise<Response>);
  },
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes(ARTICLES_URL_FRAGMENT)) {
      const r = routes.articles;
      if (!r) throw new Error(`unexpected articles fetch: ${url}`);
      return typeof r === 'function' ? await r() : r;
    }
    if (url.includes(VALUATIONS_URL_FRAGMENT)) {
      const r = routes.valuations;
      if (!r) throw new Error(`unexpected valuations fetch: ${url}`);
      return typeof r === 'function' ? await r() : r;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

const originalFetch = globalThis.fetch;

describe('LandingPage — Latest reviews + Latest valuations', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders 6 review tiles and 5 valuation rows when both endpoints return data', async () => {
    installFetchMock({
      articles: jsonResponse(200, {
        data: Array.from({ length: 6 }, (_, i) => sampleArticle(i + 1)),
        pagination: { has_more: false },
      }),
      valuations: jsonResponse(200, {
        data: Array.from({ length: 5 }, (_, i) =>
          sampleValuation(i + 1, { code: `CUR${i + 1}` }),
        ),
      }),
    });

    const { default: Page } = await import('./page');
    const { getByTestId } = await renderAsync(Page());

    const grid = getByTestId('latest-reviews-grid');
    expect(grid.querySelectorAll('li').length).toBe(6);

    const list = getByTestId('latest-valuations-list');
    expect(list.querySelectorAll('li').length).toBe(5);

    // First review tile deep-links to /cards/[card_slug].
    const firstLink = grid.querySelector('a');
    expect(firstLink?.getAttribute('href')).toMatch(/^\/cards\/card-1$/);

    // First valuation row deep-links to /valuations/[code].
    const firstValLink = list.querySelector('a');
    expect(firstValLink?.getAttribute('href')).toMatch(
      /^\/valuations\/CUR1$/,
    );
  });

  it('passes the required query params (type, limit, order) to the staging API', async () => {
    const mock = installFetchMock({
      articles: jsonResponse(200, { data: [], pagination: { has_more: false } }),
      valuations: jsonResponse(200, { data: [] }),
    });

    const { default: Page } = await import('./page');
    await renderAsync(Page());

    const articlesCall = mock.mock.calls.find((c) =>
      String(c[0]).includes('/articles'),
    );
    const valuationsCall = mock.mock.calls.find((c) =>
      String(c[0]).includes('/valuations'),
    );
    expect(articlesCall).toBeDefined();
    expect(valuationsCall).toBeDefined();

    const articlesUrl = String(articlesCall![0]);
    expect(articlesUrl).toContain('type=card_review');
    expect(articlesUrl).toContain('limit=6');
    expect(articlesUrl).toContain('order=published_at_desc');

    const valuationsUrl = String(valuationsCall![0]);
    expect(valuationsUrl).toContain('limit=5');
    expect(valuationsUrl).toContain('order=updated_at_desc');

    // ISR hint must be set to 300s so staging is not hammered.
    const articlesOpts = articlesCall![1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(articlesOpts?.next?.revalidate).toBe(300);
    const valuationsOpts = valuationsCall![1] as RequestInit & {
      next?: { revalidate?: number };
    };
    expect(valuationsOpts?.next?.revalidate).toBe(300);
  });

  it('renders the empty state for reviews with a link to /cards when the API returns []', async () => {
    installFetchMock({
      articles: jsonResponse(200, { data: [], pagination: { has_more: false } }),
      valuations: jsonResponse(200, {
        data: [sampleValuation(1, { code: 'ROP' })],
      }),
    });

    const { default: Page } = await import('./page');
    const { getByTestId, queryByTestId } = await renderAsync(Page());

    const empty = getByTestId('latest-reviews-empty');
    expect(empty.textContent).toContain('ยังไม่มีรีวิว');
    const link = empty.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/cards');

    // Valuations section should still render (independent).
    expect(queryByTestId('latest-valuations-list')).not.toBeNull();
    expect(queryByTestId('latest-reviews-grid')).toBeNull();
  });

  it('renders the empty state for valuations when the API returns []', async () => {
    installFetchMock({
      articles: jsonResponse(200, {
        data: Array.from({ length: 2 }, (_, i) => sampleArticle(i + 1)),
        pagination: { has_more: false },
      }),
      valuations: jsonResponse(200, { data: [] }),
    });

    const { default: Page } = await import('./page');
    const { getByTestId, queryByTestId } = await renderAsync(Page());

    expect(getByTestId('latest-valuations-empty').textContent).toContain(
      'ยังไม่มีข้อมูลมูลค่าแต้ม',
    );
    expect(queryByTestId('latest-valuations-list')).toBeNull();
    // And reviews still render independently.
    expect(queryByTestId('latest-reviews-grid')).not.toBeNull();
  });

  it('renders the load-error fallback for each section independently on 5xx', async () => {
    installFetchMock({
      articles: jsonResponse(500, {
        error: {
          code: 'server_error',
          message_en: 'boom',
          message_th: 'ลองใหม่',
        },
      }),
      valuations: jsonResponse(503, {
        error: {
          code: 'server_error',
          message_en: 'down',
          message_th: 'ลองใหม่',
        },
      }),
    });

    const { default: Page } = await import('./page');
    const { getByTestId } = await renderAsync(Page());

    expect(getByTestId('latest-reviews-error').textContent).toContain(
      'ยังไม่มีข้อมูล',
    );
    expect(getByTestId('latest-valuations-error').textContent).toContain(
      'ยังไม่มีข้อมูล',
    );
  });

  it('renders the load-error fallback when fetch itself throws (network failure)', async () => {
    installFetchMock({
      articles: () => {
        throw new TypeError('network down');
      },
      valuations: () => {
        throw new TypeError('network down');
      },
    });

    const { default: Page } = await import('./page');
    const { getByTestId } = await renderAsync(Page());

    expect(getByTestId('latest-reviews-error')).toBeInTheDocument();
    expect(getByTestId('latest-valuations-error')).toBeInTheDocument();
  });
});

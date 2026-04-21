import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../messages/th.json';

// `next-intl/server` in a React Server Component test environment needs a
// stub — the real implementation reads from async context. We mock
// `getTranslations` to return the same t()/t.raw shape backed by the th
// dictionary used in production.
vi.mock('next-intl/server', () => ({
  getTranslations: async (scope: string) => makeT(scope),
}));

// The page's `force-dynamic` export is a no-op in Vitest, but since it
// also imports `next/navigation`'s notFound() via the detail page we need
// a stable stub there too when we render the detail test later.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('__NOT_FOUND__');
  },
}));

function makeT(scope: string) {
  const dict = thMessages as unknown as Record<string, unknown>;
  const segments = scope.split('.');
  let node: unknown = dict;
  for (const seg of segments) {
    node = (node as Record<string, unknown>)?.[seg];
  }
  const t = (key: string, params?: Record<string, string | number>) => {
    const parts = key.split('.');
    let value: unknown = node;
    for (const p of parts) {
      value = (value as Record<string, unknown>)?.[p];
    }
    if (typeof value !== 'string') return key;
    let out = value;
    if (params) {
      for (const [p, v] of Object.entries(params)) {
        out = out.replace(new RegExp(`\\{${p}\\}`, 'g'), String(v));
      }
    }
    return out;
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

const originalFetch = globalThis.fetch;

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

const sample = (code: string, name: string, confidence = 0.8, thb = 0.9) => ({
  currency: {
    code,
    display_name_en: name,
    display_name_th: name,
    currency_type: code === 'BONVOY' ? 'hotel' : code.startsWith('K_') || code.endsWith('_REWARDS') || code === 'KTC_FOREVER' ? 'bank_proprietary' : 'airline',
  },
  thb_per_point: thb,
  methodology: 'percentile_80',
  percentile: 80,
  sample_size: 30,
  confidence,
  top_redemption_example: null,
  computed_at: '2026-04-20T00:00:00Z',
});

describe('ValuationsIndexPage', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders a badge for each of the 8 currencies returned by the API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        data: [
          sample('ROP', 'Royal Orchid Plus'),
          sample('KF', 'KrisFlyer'),
          sample('AM', 'Asia Miles'),
          sample('BONVOY', 'Marriott Bonvoy'),
          sample('K_POINT', 'K Point', 0.65),
          sample('UOB_REWARDS', 'UOB Rewards', 0.3),
          sample('KTC_FOREVER', 'KTC Forever', 0.3),
          sample('SCB_REWARDS', 'SCB Rewards', 0.3),
        ],
      }),
    );
    const { default: Page } = await import('@/app/valuations/page');
    const { getByTestId, container } = await renderAsync(Page());

    const grid = getByTestId('valuations-grid');
    const items = grid.querySelectorAll('li');
    expect(items.length).toBe(8);
    // Confirm the first entry is ROP per the spec sort order.
    const firstCode = items[0]?.querySelector(
      '[class*="tracking-wide"]',
    )?.textContent;
    expect(firstCode).toBe('ROP');
    // schema.org JSON-LD is present
    expect(container.innerHTML).toContain('CollectionPage');
  });

  it('falls back to a friendly load-error when the API rejects', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: 'server_error',
          message_en: 'boom',
          message_th: 'ลองใหม่',
        },
      }),
    );
    const { default: Page } = await import('@/app/valuations/page');
    const { getByRole } = await renderAsync(Page());
    expect(getByRole('alert').textContent).toContain('โหลดข้อมูลมูลค่าแต้ม');
  });
});

describe('ValuationDetailPage', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws NOT_FOUND when the backend returns 404 for an unknown currency', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(404, {
        error: {
          code: 'currency_not_found',
          message_en: 'nope',
          message_th: 'ไม่พบสกุลแต้มนี้',
        },
      }),
    );
    const { default: Detail } = await import(
      '@/app/valuations/[currency]/page'
    );
    await expect(
      Detail({ params: Promise.resolve({ currency: 'ZZZ' }) }),
    ).rejects.toThrow('__NOT_FOUND__');
  });
});

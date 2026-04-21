import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dynamic `generateMetadata` tests for the two primary SEO surfaces:
 *   - `/cards/[slug]`    — card review pages
 *   - `/valuations/[currency]` — per-currency valuation pages
 *
 * We stub `@/lib/api/cards` so the functions can run without the staging
 * API. Assertions focus on the OG + Twitter + hreflang outputs that the
 * W13 task specifies must be present on every indexable page.
 */

const getCardMock = vi.fn();
const getValuationMock = vi.fn();

vi.mock('@/lib/api/cards', () => ({
  getCard: (...args: unknown[]) => getCardMock(...args),
  getValuation: (...args: unknown[]) => getValuationMock(...args),
  // Unused by these tests but the modules re-export them transitively.
  listCards: vi.fn(),
  listValuations: vi.fn(),
  getConsent: vi.fn(),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
  getCardMock.mockReset();
  getValuationMock.mockReset();
  vi.resetModules();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe('generateMetadata — /cards/[slug]', () => {
  it('builds OG + Twitter fields from the card payload', async () => {
    getCardMock.mockResolvedValue({
      slug: 'kbank-the-one',
      display_name: 'KBank The One',
      description_en: 'Premium KBank card with 1.5% cashback.',
      description_th: null,
      bank: { display_name_en: 'KBank', display_name_th: 'ธ.กสิกรไทย' },
    });
    const { generateMetadata } = await import('@/app/cards/[slug]/page');
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'kbank-the-one' }),
    });

    expect(meta.title).toBe('KBank The One — KBank');
    expect(meta.description).toBe('Premium KBank card with 1.5% cashback.');

    const og = meta.openGraph as {
      type?: string;
      title?: string;
      url?: string;
      images?: Array<{ url: string; width?: number; height?: number }>;
    };
    expect(og.type).toBe('article');
    expect(og.title).toBe('KBank The One — KBank · Loftly');
    expect(og.url).toBe('https://site.test/cards/kbank-the-one');
    expect(og.images?.[0]?.url).toBe('/og-default.png');
    expect(og.images?.[0]?.width).toBe(1200);
    expect(og.images?.[0]?.height).toBe(630);

    const tw = meta.twitter as { card?: string; title?: string };
    expect(tw.card).toBe('summary_large_image');
    expect(tw.title).toBe('KBank The One — KBank · Loftly');

    const alt = meta.alternates as {
      canonical?: string;
      languages?: Record<string, string>;
    };
    expect(alt.canonical).toBe('https://site.test/cards/kbank-the-one');
    expect(alt.languages?.['th-TH']).toBe(
      'https://site.test/cards/kbank-the-one',
    );
    expect(alt.languages?.['en-US']).toBe(
      'https://site.test/en/cards/kbank-the-one',
    );
    expect(alt.languages?.['x-default']).toBe(
      'https://site.test/cards/kbank-the-one',
    );
  });

  it('falls back to a generic title when the card lookup fails', async () => {
    getCardMock.mockRejectedValue(new Error('boom'));
    const { generateMetadata } = await import('@/app/cards/[slug]/page');
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: 'missing' }),
    });
    expect(meta.title).toBe('Card review');
    const alt = meta.alternates as { canonical?: string };
    expect(alt.canonical).toBe('https://site.test/cards/missing');
  });
});

describe('generateMetadata — /valuations/[currency]', () => {
  it('builds a THB/point title + description from the valuation payload', async () => {
    getValuationMock.mockResolvedValue({
      currency: {
        code: 'ROP',
        display_name_en: 'Royal Orchid Plus',
        display_name_th: 'รอยัล ออร์คิด พลัส',
        currency_type: 'airline',
      },
      thb_per_point: 0.32,
      confidence: 0.78,
      sample_size: 42,
    });
    const { generateMetadata } = await import(
      '@/app/valuations/[currency]/page'
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ currency: 'ROP' }),
    });

    expect(meta.title).toBe('1 ROP = 0.3200 THB');
    expect(meta.description).toContain('Royal Orchid Plus');
    expect(meta.description).toContain('0.3200 THB/point');
    expect(meta.description).toContain('78% confidence');

    const og = meta.openGraph as { type?: string; url?: string };
    expect(og.type).toBe('article');
    expect(og.url).toBe('https://site.test/valuations/ROP');

    const tw = meta.twitter as { card?: string };
    expect(tw.card).toBe('summary_large_image');

    const alt = meta.alternates as {
      canonical?: string;
      languages?: Record<string, string>;
    };
    expect(alt.canonical).toBe('https://site.test/valuations/ROP');
    expect(alt.languages?.['en-US']).toBe('https://site.test/en/valuations/ROP');
  });

  it('falls back to a generic title when the valuation lookup fails', async () => {
    getValuationMock.mockRejectedValue(new Error('boom'));
    const { generateMetadata } = await import(
      '@/app/valuations/[currency]/page'
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ currency: 'ZZZ' }),
    });
    expect(meta.title).toBe('Currency valuation');
  });
});

describe('buildPageMetadata — unit', () => {
  it('applies noindex when asked', async () => {
    const { buildPageMetadata } = await import('./metadata');
    const meta = buildPageMetadata({
      title: 'Account',
      path: '/account',
      noindex: true,
    });
    const robots = meta.robots as { index?: boolean; follow?: boolean };
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);
  });

  it('produces hreflang alternates with th default + en mirror', async () => {
    const { buildPageMetadata } = await import('./metadata');
    const meta = buildPageMetadata({ title: 'X', path: '/cards' });
    const alt = meta.alternates as {
      canonical?: string;
      languages?: Record<string, string>;
    };
    expect(alt.canonical).toBe('https://site.test/cards');
    expect(alt.languages?.['th-TH']).toBe('https://site.test/cards');
    expect(alt.languages?.['en-US']).toBe('https://site.test/en/cards');
  });
});

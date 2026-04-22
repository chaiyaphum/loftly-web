import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../messages/th.json';

/**
 * Landing page — V1 product-first smoke test. The page itself is a
 * thin composition of section components; each section is tested in
 * isolation where it has meaningful logic. Here we verify the page
 * renders without throwing and mounts the hero heading.
 */

vi.mock('next-intl/server', () => ({
  getTranslations: async (scope: string) => makeT(scope),
  getLocale: async () => 'th',
}));

vi.mock('@/components/landing/HeroSearch', () => ({
  HeroSearch: () => <div data-testid="hero-search">HeroSearch</div>,
}));
vi.mock('@/components/landing/PromoTicker', () => ({
  PromoTicker: () => <div data-testid="promo-ticker">PromoTicker</div>,
}));
vi.mock('@/components/landing/HowItWorks', () => ({
  HowItWorks: () => <div data-testid="how-it-works">HowItWorks</div>,
}));
vi.mock('@/components/landing/FeaturedCards', () => ({
  FeaturedCards: () => <div data-testid="featured-cards">FeaturedCards</div>,
}));
vi.mock('@/components/landing/TrustStrip', () => ({
  TrustStrip: () => <div data-testid="trust-strip">TrustStrip</div>,
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
  return t;
}

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('LandingPage — V1 product-first', () => {
  it('renders all 5 section components in order', async () => {
    const Page = (await import('./page')).default;
    const { getByTestId, container } = render(wrap(Page()));

    expect(getByTestId('hero-search')).toBeInTheDocument();
    expect(getByTestId('promo-ticker')).toBeInTheDocument();
    expect(getByTestId('how-it-works')).toBeInTheDocument();
    expect(getByTestId('featured-cards')).toBeInTheDocument();
    expect(getByTestId('trust-strip')).toBeInTheDocument();

    // Verify section order — match the V1 section rhythm
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    const testIds = Array.from(main!.querySelectorAll('[data-testid]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(testIds).toEqual([
      'hero-search',
      'promo-ticker',
      'how-it-works',
      'featured-cards',
      'trust-strip',
    ]);
  });
});

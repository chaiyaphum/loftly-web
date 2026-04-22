import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Root layout metadata — verify the site-wide defaults that `layout.tsx`
 * exports. This is the contract every page inherits unless it explicitly
 * overrides.
 *
 * We re-import the module per test with `vi.resetModules()` so env-driven
 * values (e.g. `metadataBase` built from `NEXT_PUBLIC_SITE_URL`) are
 * re-evaluated.
 */

// `next/font/google` can't run in jsdom — the real module issues a network
// fetch at build time. We don't care about the CSS variables in these
// tests, just the exported `metadata` object.
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter' }),
  Noto_Sans_Thai_Looped: () => ({ variable: '--font-noto-thai' }),
  JetBrains_Mono: () => ({ variable: '--font-jetbrains-mono' }),
}));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe('root layout metadata', () => {
  it('exposes a title template and default title', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
    const mod = await import('./layout');
    const meta = mod.metadata;
    expect(meta.title).toBeDefined();
    const title = meta.title as { default: string; template: string };
    expect(title.default).toBe('Loftly — Lift your rewards');
    expect(title.template).toBe('%s · Loftly');
  });

  it('sets `metadataBase` from NEXT_PUBLIC_SITE_URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
    const mod = await import('./layout');
    expect(String(mod.metadata.metadataBase)).toBe('https://site.test/');
  });

  it('falls back to the staging host when NEXT_PUBLIC_SITE_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const mod = await import('./layout');
    expect(String(mod.metadata.metadataBase)).toBe(
      'https://loftly.biggo-analytics.dev/',
    );
  });

  it('declares OpenGraph site-name + locale + default image', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
    const mod = await import('./layout');
    const og = mod.metadata.openGraph as {
      type?: string;
      siteName?: string;
      locale?: string;
      alternateLocale?: string[];
      images?: Array<{ url: string; width?: number; height?: number }>;
    };
    expect(og.type).toBe('website');
    expect(og.siteName).toBe('Loftly');
    expect(og.locale).toBe('th_TH');
    expect(og.alternateLocale).toEqual(['en_US']);
    expect(og.images?.[0]?.url).toBe('/og-default.png');
    expect(og.images?.[0]?.width).toBe(1200);
    expect(og.images?.[0]?.height).toBe(630);
  });

  it('declares a summary_large_image Twitter card', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
    const mod = await import('./layout');
    const tw = mod.metadata.twitter as {
      card?: string;
      images?: Array<string>;
    };
    expect(tw.card).toBe('summary_large_image');
    expect(tw.images?.[0]).toBe('/og-default.png');
  });

  it('declares hreflang alternates for th-TH and en-US', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
    const mod = await import('./layout');
    const alt = mod.metadata.alternates as {
      languages?: Record<string, string>;
      canonical?: string;
    };
    expect(alt.languages?.['th-TH']).toBe('https://site.test/');
    expect(alt.languages?.['en-US']).toBe('https://site.test/en');
    expect(alt.languages?.['x-default']).toBe('https://site.test/');
    expect(alt.canonical).toBe('https://site.test');
  });

  it('sets robots.index=true at the root (per-page noindex overrides)', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
    const mod = await import('./layout');
    const robots = mod.metadata.robots as {
      index?: boolean;
      follow?: boolean;
    };
    expect(robots.index).toBe(true);
    expect(robots.follow).toBe(true);
  });
});

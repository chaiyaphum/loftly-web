import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../messages/th.json';
import enMessages from '../messages/en.json';

/**
 * Unit tests for `ArticleByline`.
 *
 * Covers both the default-byline path (no slug → "Loftly") and the
 * author-provided path (slug present → fetch `/v1/authors/{slug}` and render
 * the locale-aware display name). We also assert the graceful fallback to
 * "Loftly" when the backend 404s the slug, since that's the expected state
 * while the `articles.authors_id` backfill is pending.
 */

vi.mock('next-intl/server', () => ({
  getTranslations: async (scope: string) => makeT(scope, thMessages),
}));

function makeT(scope: string, dict: unknown) {
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

describe('ArticleByline', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('defaults to "Loftly" when no author slug or name is provided', async () => {
    // Asserting no network call is made — this is the hot path today
    // because `/v1/cards/{slug}` doesn't yet expose an author.
    const spy = vi.fn();
    globalThis.fetch = spy;

    const { ArticleByline } = await import(
      '@/components/articles/ArticleByline'
    );

    const { getByTestId } = await renderAsync(
      ArticleByline({
        publishedAt: '2026-04-21T00:00:00Z',
        readingMinutes: 4,
      }),
    );

    expect(getByTestId('article-byline').textContent).toContain('โดย Loftly');
    expect(spy).not.toHaveBeenCalled();
  });

  it('renders `authorName` directly without fetching when the name is passed', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy;

    const { ArticleByline } = await import(
      '@/components/articles/ArticleByline'
    );

    const { getByTestId } = await renderAsync(
      ArticleByline({
        publishedAt: '2026-04-21T00:00:00Z',
        readingMinutes: 4,
        authorName: 'ชัยยภูมิ',
      }),
    );

    expect(getByTestId('article-byline').textContent).toContain('โดย ชัยยภูมิ');
    // `authorName` takes precedence — no fetch even if a slug were provided.
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches /v1/authors/{slug} and renders the display_name when slug is provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: '10ff1170-0000-4000-8000-000000000001',
        slug: 'chai',
        display_name: 'ชัยยภูมิ',
        display_name_en: 'Chai',
        bio_th: null,
        bio_en: null,
        role: 'contractor',
        image_url: null,
        created_at: '2026-04-21T00:00:00Z',
      }),
    );

    const { ArticleByline } = await import(
      '@/components/articles/ArticleByline'
    );

    const { getByTestId } = await renderAsync(
      ArticleByline({
        publishedAt: '2026-04-21T00:00:00Z',
        readingMinutes: 4,
        authorSlug: 'chai',
      }),
    );

    expect(getByTestId('article-byline').textContent).toContain('โดย ชัยยภูมิ');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toContain('/authors/chai');
  });

  it('prefers display_name_en when locale is "en"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'x',
        slug: 'chai',
        display_name: 'ชัยยภูมิ',
        display_name_en: 'Chai',
        role: 'contractor',
        created_at: '2026-04-21T00:00:00Z',
      }),
    );

    // Use the en dictionary + locale to exercise the English path.
    const wrapEn = (ui: React.ReactNode) => (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {ui}
      </NextIntlClientProvider>
    );

    // Re-mock getTranslations to back the byline scope with the en dict.
    vi.doMock('next-intl/server', () => ({
      getTranslations: async (scope: string) => makeT(scope, enMessages),
    }));
    vi.resetModules();

    const { ArticleByline } = await import(
      '@/components/articles/ArticleByline'
    );

    const resolved = await ArticleByline({
      publishedAt: '2026-04-21T00:00:00Z',
      readingMinutes: 4,
      authorSlug: 'chai',
      locale: 'en',
    });
    const { getByTestId } = render(wrapEn(resolved));

    expect(getByTestId('article-byline').textContent).toContain('By Chai');
  });

  it('falls back to "Loftly" when the backend 404s the slug (pre-backfill state)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(404, {
        error: {
          code: 'not_found',
          message_en: 'Unknown author slug: ghost',
          message_th: 'ไม่พบผู้เขียนที่ระบุ',
        },
      }),
    );

    // Reset the module registry so the earlier vi.doMock doesn't leak.
    vi.resetModules();
    vi.doMock('next-intl/server', () => ({
      getTranslations: async (scope: string) => makeT(scope, thMessages),
    }));

    const { ArticleByline } = await import(
      '@/components/articles/ArticleByline'
    );

    const { getByTestId } = await renderAsync(
      ArticleByline({
        publishedAt: '2026-04-21T00:00:00Z',
        readingMinutes: 4,
        authorSlug: 'ghost',
      }),
    );

    expect(getByTestId('article-byline').textContent).toContain('โดย Loftly');
  });

  it('falls back to "Loftly" when the backend returns the row without a display_name', async () => {
    // Defensive: if the API ever ships an empty display_name we don't want
    // to render "โดย " with a dangling preposition.
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'x',
        slug: 'weird',
        display_name: '',
        created_at: '2026-04-21T00:00:00Z',
      }),
    );

    vi.resetModules();
    vi.doMock('next-intl/server', () => ({
      getTranslations: async (scope: string) => makeT(scope, thMessages),
    }));
    const { ArticleByline } = await import(
      '@/components/articles/ArticleByline'
    );

    const { getByTestId } = await renderAsync(
      ArticleByline({
        publishedAt: '2026-04-21T00:00:00Z',
        readingMinutes: 4,
        authorSlug: 'weird',
      }),
    );

    expect(getByTestId('article-byline').textContent).toContain('โดย Loftly');
  });
});

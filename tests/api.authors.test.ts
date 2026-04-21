import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthor } from '@/lib/api/authors';
import { LoftlyAPIError } from '@/lib/api/client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('authors API client', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('GETs /authors/{slug} and returns the Author shape', async () => {
    const spy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: '10ff1170-0000-4000-8000-000000000001',
        slug: 'loftly',
        display_name: 'Loftly',
        display_name_en: 'Loftly',
        role: 'organization',
        bio_th: null,
        bio_en: null,
        image_url: null,
        created_at: '2026-04-21T00:00:00Z',
      }),
    );
    globalThis.fetch = spy;

    const author = await getAuthor('loftly');
    expect(author.slug).toBe('loftly');
    expect(author.display_name).toBe('Loftly');
    expect(author.role).toBe('organization');

    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/authors/loftly');
    expect((call?.[1] as RequestInit).method).toBe('GET');
  });

  it('URL-encodes slugs with special characters', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {
          id: 'x',
          slug: 'a b',
          display_name: 'A B',
          created_at: '2026-04-21T00:00:00Z',
        }),
      );
    globalThis.fetch = spy;

    await getAuthor('a b');
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/authors/a%20b');
  });

  it('throws LoftlyAPIError on 404 so callers can fall back to the default byline', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(404, {
        error: {
          code: 'not_found',
          message_en: 'Unknown author slug: ghost',
          message_th: 'ไม่พบผู้เขียนที่ระบุ',
          details: { slug: 'ghost' },
        },
      }),
    );

    // Single call — reusing `await expect(...).rejects` twice would fire
    // the fetch twice and the second call hits the cached mock but with
    // fresh counters, which also works; prefer a single assertion for clarity.
    try {
      await getAuthor('ghost');
      expect.fail('expected getAuthor to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(LoftlyAPIError);
      expect((err as LoftlyAPIError).status).toBe(404);
      expect((err as LoftlyAPIError).code).toBe('not_found');
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignMappingQueueItem,
  createAdminArticle,
  createAdminCard,
  createAdminPromo,
  getAffiliateExportUrl,
  getAffiliateStats,
  listAdminArticles,
  listAdminCards,
  listAdminPromos,
  listMappingQueue,
  updateAdminArticle,
  updateAdminCard,
  updateAdminPromo,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('admin API helpers', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws without an admin token', async () => {
    expect(() => listAdminCards(null)).toThrow(LoftlyAPIError);
  });

  it('listAdminCards hits /admin/cards with the bearer token', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], pagination: { has_more: false } }));
    globalThis.fetch = spy;

    await listAdminCards('tok-admin');
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/admin/cards');
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe('GET');
    expect(
      (init.headers as Record<string, string>)['Authorization'],
    ).toBe('Bearer tok-admin');
  });

  it('listAdminCards appends the status filter', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], pagination: { has_more: false } }));
    globalThis.fetch = spy;

    await listAdminCards('tok', { status: 'active' });
    expect(spy.mock.calls[0]?.[0]).toContain('status=active');
  });

  it('createAdminCard POSTs a CardUpsert body', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(201, { id: 'c-1' }));
    globalThis.fetch = spy;

    await createAdminCard(
      {
        display_name: 'Test',
        bank_slug: 'kbank',
        network: 'Visa',
        earn_currency_code: 'K_POINT',
        earn_rate_local: { online: 2 },
        status: 'active',
      },
      'tok',
    );
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).display_name).toBe('Test');
  });

  it('updateAdminCard PATCHes /admin/cards/{id}', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(200, { id: 'c-1' }));
    globalThis.fetch = spy;

    await updateAdminCard('c-1', { status: 'archived' }, 'tok');
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/admin/cards/c-1');
    expect((call?.[1] as RequestInit).method).toBe('PATCH');
  });

  it('listAdminArticles threads state + card_id filters', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], pagination: { has_more: false } }));
    globalThis.fetch = spy;

    await listAdminArticles('tok', { state: 'published', card_id: 'c-1' });
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toContain('state=published');
    expect(url).toContain('card_id=c-1');
  });

  it('createAdminArticle + updateAdminArticle target /admin/articles', async () => {
    const spy = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(201, { id: 'a-1' })),
      );
    globalThis.fetch = spy;

    await createAdminArticle(
      {
        article_type: 'card_review',
        title_th: 't',
        summary_th: 's',
        body_th: 'b',
        state: 'draft',
      },
      'tok',
    );
    expect(spy.mock.calls[0]?.[0]).toContain('/admin/articles');

    await updateAdminArticle('a-1', { state: 'published' }, 'tok');
    expect(spy.mock.calls[1]?.[0]).toContain('/admin/articles/a-1');
  });

  it('listAdminPromos threads bank/active/manual_only filters', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], pagination: { has_more: false } }));
    globalThis.fetch = spy;

    await listAdminPromos('tok', { bank: 'kbank', active: true, manual_only: true });
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toContain('bank=kbank');
    expect(url).toContain('active=true');
    expect(url).toContain('manual_only=true');
  });

  it('createAdminPromo + updateAdminPromo target /admin/promos', async () => {
    const spy = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse(201, { id: 'p-1' })),
      );
    globalThis.fetch = spy;

    await createAdminPromo(
      {
        bank_slug: 'kbank',
        source_url: 'https://example.com',
        promo_type: 'category_bonus',
        title_th: 't',
        active: true,
      },
      'tok',
    );
    expect(spy.mock.calls[0]?.[0]).toContain('/admin/promos');

    await updateAdminPromo('p-1', { active: false }, 'tok');
    expect(spy.mock.calls[1]?.[0]).toContain('/admin/promos/p-1');
  });

  it('listMappingQueue returns MappingQueue', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [], total: 0 }));
    globalThis.fetch = spy;

    const q = await listMappingQueue('tok');
    expect(q.total).toBe(0);
    expect(spy.mock.calls[0]?.[0]).toContain('/admin/mapping-queue');
  });

  it('assignMappingQueueItem POSTs to /admin/mapping-queue/{id}/assign', async () => {
    const spy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = spy;

    await assignMappingQueueItem('p-1', ['c-1', 'c-2'], 'tok');
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/admin/mapping-queue/p-1/assign');
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body.card_ids).toEqual(['c-1', 'c-2']);
  });

  it('getAffiliateStats returns AffiliateStats', async () => {
    const payload = {
      period_days: 30,
      clicks: 100,
      conversions: 10,
      conversion_rate: 0.1,
      commission_pending_thb: 0,
      commission_confirmed_thb: 0,
      commission_paid_thb: 0,
      by_card: [],
    };
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, payload));
    const stats = await getAffiliateStats('tok');
    expect(stats.clicks).toBe(100);
  });

  it('getAffiliateExportUrl appends token as a query param', () => {
    const url = getAffiliateExportUrl('tok-abc');
    expect(url).toContain('/admin/affiliate/export.csv');
    expect(url).toContain('token=tok-abc');
  });

  it('surfaces 401 as a LoftlyAPIError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(401, {
        error: { code: 'invalid_token', message_en: 'Admin JWT required' },
      }),
    );
    await expect(listAdminCards('tok')).rejects.toBeInstanceOf(LoftlyAPIError);
  });
});

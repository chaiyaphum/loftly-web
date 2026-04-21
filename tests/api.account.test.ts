import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAccountDelete,
  getDataExportStatus,
  requestAccountDelete,
  requestDataExport,
} from '@/lib/api/account';
import { LoftlyAPIError } from '@/lib/api/client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('account API helpers', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requestDataExport POSTs and returns the JobHandle shape', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(202, { job_id: 'job-1', status: 'queued' }),
      );
    globalThis.fetch = spy;

    const handle = await requestDataExport(null);
    expect(handle).toEqual({ job_id: 'job-1', status: 'queued' });
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/account/data-export/request');
    expect((call?.[1] as RequestInit).method).toBe('POST');
  });

  it('getDataExportStatus returns the ExportJob shape when done', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        job_id: 'job-1',
        status: 'done',
        download_url: 'https://cdn.example/export.zip',
        expires_at: '2026-04-23T00:00:00Z',
      }),
    );
    const job = await getDataExportStatus('job-1', null);
    expect(job.status).toBe('done');
    expect(job.download_url).toBe('https://cdn.example/export.zip');
  });

  it('surfaces the 501 stub response as a LoftlyAPIError callers can handle', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(501, {
        error: {
          code: 'not_implemented',
          message_en: 'coming soon',
          message_th: 'บริการนี้จะพร้อมใช้เร็ว ๆ นี้',
        },
      }),
    );
    await expect(requestDataExport(null)).rejects.toMatchObject({
      name: 'LoftlyAPIError',
      status: 501,
      code: 'not_implemented',
    });
  });

  it('requestAccountDelete returns DeleteStatus pending + grace window', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: 'pending',
        requested_at: '2026-04-21T00:00:00Z',
        grace_ends_at: '2026-05-05T00:00:00Z',
      }),
    );
    const s = await requestAccountDelete(null);
    expect(s.status).toBe('pending');
    expect(s.grace_ends_at).toBe('2026-05-05T00:00:00Z');
  });

  it('cancelAccountDelete returns DeleteStatus cancelled', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, { status: 'cancelled' }),
    );
    const s = await cancelAccountDelete(null);
    expect(s.status).toBe('cancelled');
  });

  it('throws LoftlyAPIError on 429 rate-limit responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(429, {
        error: {
          code: 'rate_limited',
          message_en: 'Too many requests',
          message_th: 'เกินโควตา',
        },
      }),
    );
    await expect(requestDataExport(null)).rejects.toBeInstanceOf(LoftlyAPIError);
  });
});

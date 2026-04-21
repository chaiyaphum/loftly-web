import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, LoftlyAPIError } from '@/lib/api/client';

const originalFetch = globalThis.fetch;

function makeResponse(
  status: number,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    status,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns typed JSON on 200', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(200, { data: [], pagination: { has_more: false } }));
    const out = await apiFetch<{ data: unknown[] }>('/cards');
    expect(out).toEqual({ data: [], pagination: { has_more: false } });
  });

  it('parses the Error envelope on 4xx and throws LoftlyAPIError', async () => {
    const env = {
      error: {
        code: 'card_not_found',
        message_en: 'Card not found',
        message_th: 'ไม่พบบัตร',
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValueOnce(makeResponse(404, env));
    await expect(apiFetch('/cards/nope')).rejects.toMatchObject({
      name: 'LoftlyAPIError',
      status: 404,
      code: 'card_not_found',
      message_en: 'Card not found',
      message_th: 'ไม่พบบัตร',
    });
  });

  it('does NOT retry on 4xx', async () => {
    const env = { error: { code: 'bad_request', message_en: 'bad' } };
    const spy = vi.fn().mockResolvedValue(makeResponse(400, env));
    globalThis.fetch = spy;
    await expect(apiFetch('/cards')).rejects.toBeInstanceOf(LoftlyAPIError);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('retries once on 5xx and succeeds on second attempt', async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503, { error: { code: 'x', message_en: 'x' } }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    globalThis.fetch = spy;
    const out = await apiFetch<{ ok: boolean }>('/cards');
    expect(out).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throws LoftlyAPIError when 5xx persists after retry', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(makeResponse(500, { error: { code: 'srv', message_en: 'boom' } }));
    globalThis.fetch = spy;
    await expect(apiFetch('/cards')).rejects.toMatchObject({
      status: 500,
      code: 'srv',
    });
    // Called twice: initial + 1 retry.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throws a request_timeout LoftlyAPIError when fetch aborts past timeoutMs', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });
    await expect(
      apiFetch('/cards', { timeoutMs: 10, maxRetries: 0 }),
    ).rejects.toMatchObject({
      name: 'LoftlyAPIError',
      code: 'request_timeout',
      status: 0,
    });
  });

  it('sends Authorization header only when accessToken provided', async () => {
    const spy = vi.fn().mockResolvedValue(makeResponse(200, {}));
    globalThis.fetch = spy;
    await apiFetch('/consent', { accessToken: 'tok123' });
    const call = spy.mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer tok123',
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestMagicLink, consumeMagicLink } from '@/lib/api/auth';
import { LoftlyAPIError } from '@/lib/api/client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('auth API helpers', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('requestMagicLink POSTs email-only body when no sessionId supplied', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(202, null));
    globalThis.fetch = spy;

    await requestMagicLink('a@b.co');
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/auth/magic-link/request');
    const init = call?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ email: 'a@b.co' });
  });

  it('requestMagicLink includes session_id when supplied', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(202, null));
    globalThis.fetch = spy;

    await requestMagicLink('a@b.co', 'sess-1');
    const call = spy.mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body).toEqual({ email: 'a@b.co', session_id: 'sess-1' });
  });

  it('requestMagicLink parses Error envelope on 4xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'invalid_email', message_en: 'Invalid email', message_th: 'อีเมลไม่ถูกต้อง' },
      }),
    );
    await expect(requestMagicLink('bad')).rejects.toMatchObject({
      name: 'LoftlyAPIError',
      code: 'invalid_email',
      message_th: 'อีเมลไม่ถูกต้อง',
      status: 400,
    });
  });

  it('consumeMagicLink returns TokenPair on success', async () => {
    const pair = {
      access_token: 'at',
      refresh_token: 'rt',
      expires_in: 900,
      user: { id: 'u1', email: 'a@b.co', locale: 'th', role: 'user' },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, pair));
    const out = await consumeMagicLink('tok123');
    expect(out.access_token).toBe('at');
    expect(out.user?.email).toBe('a@b.co');
  });

  it('consumeMagicLink throws LoftlyAPIError with backend code on expired link', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(401, {
        error: { code: 'magic_link_expired', message_en: 'expired', message_th: 'ลิงก์หมดอายุ' },
      }),
    );
    await expect(consumeMagicLink('old-token')).rejects.toBeInstanceOf(
      LoftlyAPIError,
    );
  });
});

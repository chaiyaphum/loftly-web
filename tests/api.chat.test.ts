/**
 * Unit tests for the `postSelectorChat` API helper (POST_V1 §1, Tier A).
 *
 * Validates:
 *   - URL + method + body shape for a 200 response.
 *   - Typed error surface for 403 (email-gate), 410 (expired), 429 (rate-limit).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postSelectorChat } from '@/lib/api/chat';
import { LoftlyAPIError } from '@/lib/api/client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('postSelectorChat', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs the question to /selector/{id}/chat and returns the parsed response', async () => {
    const spy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        answer_th: 'เพราะ online สูง',
        answer_en: 'online spend is high',
        category: 'explain',
        cards_changed: false,
        new_stack: null,
        rationale_diff_bullets: [],
        remaining_questions: 9,
      }),
    );
    globalThis.fetch = spy;

    const res = await postSelectorChat('sess-1', 'ทำไมอันดับ 1?');
    expect(res.category).toBe('explain');
    expect(res.remaining_questions).toBe(9);

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://example.test/v1/selector/sess-1/chat');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      question: 'ทำไมอันดับ 1?',
    });
  });

  it('throws a LoftlyAPIError with status 429 when the server rate-limits', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(429, {
        error: {
          code: 'selector_chat_rate_limited',
          message_en: 'Rate limited',
          message_th: 'คำถามต่อเซสชันครบแล้ว',
        },
      }),
    ) as unknown as typeof fetch;

    await expect(postSelectorChat('sess-1', 'q')).rejects.toMatchObject({
      status: 429,
      code: 'selector_chat_rate_limited',
    });
  });

  it('throws a LoftlyAPIError with status 403 when an email-gate is required', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        error: {
          code: 'selector_chat_email_required',
          message_en: 'Email required',
          message_th: 'กรุณากรอกอีเมล',
        },
      }),
    ) as unknown as typeof fetch;

    await expect(postSelectorChat('sess-1', 'q')).rejects.toBeInstanceOf(
      LoftlyAPIError,
    );
    await expect(postSelectorChat('sess-1', 'q')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('throws a LoftlyAPIError with status 410 when the session has expired', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(410, {
        error: {
          code: 'selector_session_expired',
          message_en: 'Session expired',
          message_th: 'เซสชันหมดอายุ',
        },
      }),
    ) as unknown as typeof fetch;

    await expect(postSelectorChat('sess-1', 'q')).rejects.toMatchObject({
      status: 410,
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitSelector, getSelectorResult } from '@/lib/api/selector';
import type { SelectorInput, SelectorResult } from '@/lib/api/types';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sampleResult(): SelectorResult {
  return {
    session_id: '11111111-1111-1111-1111-111111111111',
    stack: [
      {
        card_id: 'c1',
        slug: 'kbank-wisdom',
        role: 'primary',
        monthly_earning_points: 5400,
        monthly_earning_thb_equivalent: 8200,
        annual_fee_thb: 5000,
        reason_th: 'ใช้จ่าย online สูง',
      },
    ],
    total_monthly_earning_points: 5400,
    total_monthly_earning_thb_equivalent: 8200,
    months_to_goal: 14,
    valuation_confidence: 0.82,
    rationale_th: 'ด้วยการใช้จ่าย…',
    warnings: [],
    llm_model: 'claude-sonnet-4',
    fallback: false,
    partial_unlock: true,
  };
}

describe('selector API helpers', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('submitSelector POSTs the input and returns the parsed result', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(200, sampleResult()));
    globalThis.fetch = spy;

    const input: SelectorInput = {
      monthly_spend_thb: 80_000,
      spend_categories: { dining: 15000, online: 20000, travel: 25000, grocery: 10000, other: 10000 },
      goal: { type: 'miles', currency_preference: 'ROP', horizon_months: 12, target_points: 90000 },
      locale: 'th',
    };

    const result = await submitSelector(input);
    expect(result.session_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(result.stack[0]?.slug).toBe('kbank-wisdom');

    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('http://example.test/v1/selector');
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.monthly_spend_thb).toBe(80000);
    expect(body.goal.type).toBe('miles');
  });

  it('getSelectorResult appends the token query param when supplied', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(200, sampleResult()));
    globalThis.fetch = spy;

    await getSelectorResult('abc-123', 'tok-xyz');

    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/selector/abc-123');
    expect(call?.[0]).toContain('token=tok-xyz');
  });

  it('getSelectorResult omits the token param when not provided', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(200, sampleResult()));
    globalThis.fetch = spy;

    await getSelectorResult('abc-123');
    const call = spy.mock.calls[0];
    expect(call?.[0]).not.toContain('token=');
  });
});

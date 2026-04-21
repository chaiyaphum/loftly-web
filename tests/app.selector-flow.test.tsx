import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../messages/th.json';

// Mock `next/navigation.useRouter` so the form can push without a real App
// Router in the test environment.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/selector',
  useSearchParams: () => new URLSearchParams(),
}));

// Import after mock so the hook resolves to our stub.
const { SelectorForm } = await import('@/app/selector/SelectorForm');

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

describe('Selector form submission flow', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
    push.mockReset();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs the input and navigates to /selector/results/[id] on success', async () => {
    const sessionId = '11111111-1111-1111-1111-111111111111';
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        session_id: sessionId,
        stack: [],
        total_monthly_earning_points: 0,
        total_monthly_earning_thb_equivalent: 0,
        valuation_confidence: 0.8,
        rationale_th: '…',
        warnings: [],
        llm_model: 'claude-sonnet-4',
        fallback: false,
      }),
    );

    render(wrap(<SelectorForm />));

    const submit = screen.getByRole('button', { name: /ค้นหาบัตรแนะนำ/ });
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        `/selector/results/${sessionId}`,
      );
    });
  });

  it('surfaces the API error_th instead of navigating on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: 'selector_failed',
          message_en: 'Selector failed',
          message_th: 'คำนวณไม่สำเร็จ',
        },
      }),
    );

    render(wrap(<SelectorForm />));

    const submit = screen.getByRole('button', { name: /ค้นหาบัตรแนะนำ/ });
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'คำนวณไม่สำเร็จ',
      );
    });
    expect(push).not.toHaveBeenCalled();
  });
});

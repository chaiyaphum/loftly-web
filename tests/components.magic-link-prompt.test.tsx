import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { MagicLinkPrompt } from '@/components/loftly/MagicLinkPrompt';
import thMessages from '../messages/th.json';

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

describe('MagicLinkPrompt', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('submits email + sessionId and shows success copy with the email interpolated', async () => {
    const spy = vi.fn().mockResolvedValue(jsonResponse(202, null));
    globalThis.fetch = spy;

    render(wrap(<MagicLinkPrompt sessionId="sess-xyz" />));

    const input = screen.getByLabelText(/ใส่อีเมล/);
    act(() => {
      fireEvent.change(input, { target: { value: 'hi@example.com' } });
    });
    const submit = screen.getByRole('button', { name: /ส่งลิงก์/ });
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    expect(screen.getByRole('status').textContent).toContain('hi@example.com');

    const body = JSON.parse((spy.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ email: 'hi@example.com', session_id: 'sess-xyz' });
  });

  it('shows inline validation error on bad email without calling the API', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy;

    render(wrap(<MagicLinkPrompt />));

    const input = screen.getByLabelText(/ใส่อีเมล/);
    act(() => {
      fireEvent.change(input, { target: { value: 'not-an-email' } });
    });
    const submit = screen.getByRole('button', { name: /ส่งลิงก์/ });
    await act(async () => {
      fireEvent.click(submit);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('surfaces the Thai error message from the API envelope on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(429, {
        error: {
          code: 'rate_limited',
          message_en: 'Too many requests',
          message_th: 'ส่งถี่เกินไป ลองใหม่ภายหลัง',
        },
      }),
    );

    render(wrap(<MagicLinkPrompt />));

    const input = screen.getByLabelText(/ใส่อีเมล/);
    act(() => {
      fireEvent.change(input, { target: { value: 'ok@example.com' } });
    });
    const submit = screen.getByRole('button', { name: /ส่งลิงก์/ });
    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'ส่งถี่เกินไป',
      );
    });
  });
});

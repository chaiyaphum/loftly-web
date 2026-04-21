import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { MagicLinkPrompt } from '@/components/loftly/MagicLinkPrompt';
import thMessages from '../messages/th.json';

const mockTrack = vi.fn();
vi.mock('@/lib/analytics', () => ({
  useTrackEvent: () => mockTrack,
}));

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

// Flush enqueued microtasks (Promise resolutions) without depending on timers.
// The apiFetch wrapper chains several `await`s (response, .json(), state set)
// so we pump generously to let them all resolve under fake-timer mode.
async function flushPromises(n = 20) {
  for (let i = 0; i < n; i++) {
    await Promise.resolve();
  }
}

describe('MagicLinkPrompt', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
    mockTrack.mockReset();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
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

  describe('resend CTA (POST_V1 §2)', () => {
    // Use fake timers from the start so the 30s reveal + cooldown are
    // deterministic. We flush the fetch microtask chain with `flushPromises`
    // instead of relying on `waitFor` (which would stall under fake timers).

    async function submitInitial(
      fetchImpl: typeof fetch,
      sessionId = 'sess-xyz',
      email = 'hi@example.com',
    ) {
      vi.useFakeTimers();
      globalThis.fetch = fetchImpl;
      render(wrap(<MagicLinkPrompt sessionId={sessionId} />));

      const input = screen.getByLabelText(/ใส่อีเมล/);
      act(() => {
        fireEvent.change(input, { target: { value: email } });
      });
      const submit = screen.getByRole('button', { name: /ส่งลิงก์/ });
      await act(async () => {
        fireEvent.click(submit);
        await flushPromises();
      });
      // Sanity: the success panel is rendered before we proceed.
      expect(screen.getByRole('status')).toBeInTheDocument();
    }

    it('reveals resend button after 30s', async () => {
      await submitInitial(vi.fn().mockResolvedValue(jsonResponse(202, null)));

      expect(
        screen.queryByTestId('magic-link-resend-button'),
      ).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(
        screen.getByTestId('magic-link-resend-button'),
      ).toBeInTheDocument();
    });

    it('clicking resend re-invokes API with same email + sessionId and shows success', async () => {
      // Return a fresh Response per call (Response bodies are one-shot).
      const spy = vi
        .fn()
        .mockImplementation(async () => jsonResponse(202, null));
      await submitInitial(spy, 'sess-xyz', 'hi@example.com');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      const btn = screen.getByTestId('magic-link-resend-button');
      await act(async () => {
        fireEvent.click(btn);
      });
      // Flush fetch + response.json() + setState microtasks.
      await act(async () => {
        await flushPromises();
        await vi.advanceTimersByTimeAsync(0);
        await flushPromises();
      });

      expect(spy).toHaveBeenCalledTimes(2);
      const resendBody = JSON.parse(
        (spy.mock.calls[1]?.[1] as RequestInit).body as string,
      );
      expect(resendBody).toEqual({
        email: 'hi@example.com',
        session_id: 'sess-xyz',
      });

      expect(
        screen.getByTestId('magic-link-resend-success'),
      ).toBeInTheDocument();

      expect(mockTrack).toHaveBeenCalledWith('welcome_email_resend_clicked', {
        session_id: 'sess-xyz',
      });
    });

    it('resend 429 shows rate-limit error and re-enables after cooldown', async () => {
      const spy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(202, null))
        .mockResolvedValueOnce(
          jsonResponse(429, {
            error: {
              code: 'rate_limited',
              message_en: 'Too many requests',
              message_th: 'ส่งถี่เกินไป',
            },
          }),
        );
      await submitInitial(spy, 'sess-xyz', 'ok@example.com');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      const btn = screen.getByTestId('magic-link-resend-button');
      await act(async () => {
        fireEvent.click(btn);
        await flushPromises();
        // Flush the zero-timeout bridge that hands off to the cooldown.
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(
        screen.getByTestId('magic-link-resend-error'),
      ).toBeInTheDocument();

      expect(screen.getByTestId('magic-link-resend-button')).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(screen.getByTestId('magic-link-resend-button')).not.toBeDisabled();
    });

    it('button is disabled while resend is in flight', async () => {
      let resolveResend: ((r: Response) => void) | null = null;
      const resendPromise = new Promise<Response>((res) => {
        resolveResend = res;
      });

      const spy = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(202, null))
        .mockReturnValueOnce(resendPromise);
      await submitInitial(spy, 'sess-xyz', 'ok@example.com');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      const btn = screen.getByTestId('magic-link-resend-button');
      await act(async () => {
        fireEvent.click(btn);
        await flushPromises();
      });

      expect(screen.getByTestId('magic-link-resend-button')).toBeDisabled();

      // Clean up the unresolved promise so the test exits cleanly.
      await act(async () => {
        resolveResend?.(jsonResponse(202, null));
        await flushPromises();
      });
    });
  });
});

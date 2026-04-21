import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../messages/th.json';
import { DeleteAccountClient } from '@/app/account/delete/DeleteAccountClient';

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

describe('DeleteAccountClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('keeps the submit button disabled until the typed email matches the registered email', () => {
    render(
      wrap(
        <DeleteAccountClient registeredEmail="user@example.com" />,
      ),
    );
    const submit = screen.getByTestId('delete-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = screen.getByTestId('delete-email-confirm') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'wrong@example.com' } });
    expect(submit.disabled).toBe(true);
    // Mismatch hint surfaces
    expect(screen.getByText('อีเมลไม่ตรงกับบัญชีของคุณ')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'user@example.com' } });
    expect(submit.disabled).toBe(false);
  });

  it('submits and transitions to pending state with the grace countdown', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        status: 'pending',
        requested_at: '2026-04-21T00:00:00Z',
        grace_ends_at: '2026-05-05T00:00:00Z',
      }),
    );

    render(
      wrap(<DeleteAccountClient registeredEmail="user@example.com" />),
    );
    const input = screen.getByTestId('delete-email-confirm') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-submit'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-pending')).toBeInTheDocument();
    });
  });

  it('renders the "coming soon" notice when the backend returns 501', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(501, {
        error: {
          code: 'not_implemented',
          message_en: 'coming soon',
          message_th: 'บริการนี้จะพร้อมใช้เร็ว ๆ นี้',
        },
      }),
    );
    render(
      wrap(<DeleteAccountClient registeredEmail="user@example.com" />),
    );
    const input = screen.getByTestId('delete-email-confirm') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-submit'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('delete-not-available')).toBeInTheDocument();
    });
  });
});

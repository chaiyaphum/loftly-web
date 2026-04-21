import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../messages/en.json';

/**
 * Tests for the multi-pathway invite-required page (W11 UX follow-up).
 *
 * Covers:
 *   - All three sections render (have-code form, waitlist form, follow links)
 *   - `invite_required_viewed` PostHog event fires on mount
 *   - Waitlist success path emits `invite_required_waitlist_joined` + renders
 *     the success banner with the right copy
 *   - Waitlist 429 renders the rate-limited message and does NOT emit the
 *     success event
 */

const mockCapture = vi.fn();

vi.mock('@/lib/posthog', () => ({
  loadPostHog: vi.fn().mockImplementation(async () => null),
  getPostHog: vi.fn().mockImplementation(() => null),
  capture: (event: string, props?: Record<string, unknown>) =>
    mockCapture(event, props),
}));

import { InviteRequiredClient } from './InviteRequiredClient';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('InviteRequiredClient', () => {
  beforeEach(() => {
    mockCapture.mockReset();
  });

  it('renders all three pathways (have-code, waitlist, follow-launch)', async () => {
    render(wrap(<InviteRequiredClient hasError={false} />));

    // 1. Have-code form — the original invite submission UI.
    expect(screen.getByTestId('invite-section-have-code')).toBeInTheDocument();
    expect(screen.getByLabelText(/^invite code$/i)).toBeInTheDocument();

    // 2. Waitlist join — email capture for the next wave.
    expect(screen.getByTestId('invite-section-waitlist')).toBeInTheDocument();
    expect(screen.getByTestId('invite-waitlist-email')).toBeInTheDocument();
    expect(screen.getByTestId('invite-waitlist-submit')).toBeInTheDocument();

    // 3. Follow-launch — Pantip / LINE OA / Twitter links.
    expect(screen.getByTestId('invite-section-follow')).toBeInTheDocument();
    expect(screen.getByTestId('invite-follow-pantip')).toHaveAttribute(
      'href',
      expect.stringContaining('pantip.com'),
    );
    expect(screen.getByTestId('invite-follow-line')).toHaveAttribute(
      'href',
      expect.stringContaining('line.me'),
    );
    expect(screen.getByTestId('invite-follow-twitter')).toHaveAttribute(
      'href',
      expect.stringContaining('twitter.com'),
    );

    // PostHog page-view event fires once on mount. The wrapper in the test
    // mock always forwards two args (event, props) so match on event only.
    await waitFor(() => {
      const firstCall = mockCapture.mock.calls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall?.[0]).toBe('invite_required_viewed');
    });
  });

  it('emits `invite_required_waitlist_joined` and shows the success banner on a 201 from the proxy', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'created' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(wrap(<InviteRequiredClient hasError={false} />));

    fireEvent.change(screen.getByTestId('invite-waitlist-email'), {
      target: { value: 'new@example.com' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('invite-waitlist-submit'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('invite-waitlist-success')).toBeInTheDocument(),
    );

    const success = screen.getByTestId('invite-waitlist-success');
    expect(success).toHaveAttribute('data-status', 'created');
    expect(success).toHaveTextContent(/new@example\.com/);

    // Only the success branch should fire the joined event.
    expect(mockCapture).toHaveBeenCalledWith(
      'invite_required_waitlist_joined',
      expect.objectContaining({ status: 'created' }),
    );

    // And we hit the local proxy, not the upstream directly.
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/invite/waitlist-join',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renders the rate_limited message on 429 and does not emit the joined event', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(wrap(<InviteRequiredClient hasError={false} />));

    fireEvent.change(screen.getByTestId('invite-waitlist-email'), {
      target: { value: 'spammy@example.com' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('invite-waitlist-submit'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('invite-waitlist-error')).toBeInTheDocument(),
    );

    const err = screen.getByTestId('invite-waitlist-error');
    expect(err).toHaveAttribute('data-status', 'rate_limited');
    expect(err).toHaveTextContent(/5 minutes/);

    // The success banner MUST NOT render on a non-success status …
    expect(
      screen.queryByTestId('invite-waitlist-success'),
    ).not.toBeInTheDocument();

    // … and the joined event must not have fired.
    expect(mockCapture).not.toHaveBeenCalledWith(
      'invite_required_waitlist_joined',
      expect.anything(),
    );
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../messages/en.json';

// Mock the PostHog module exactly as feature-flags.test.tsx does — we drive
// `getFeatureFlag` deterministically and assert `capture` is called.
const mockGetFeatureFlag = vi.fn<(key: string) => string | boolean | undefined>();
const mockOnFeatureFlags = vi.fn<(cb: () => void) => () => void>();
const mockCapture = vi.fn();

vi.mock('@/lib/posthog', () => ({
  loadPostHog: vi.fn().mockImplementation(async () => ({
    getFeatureFlag: mockGetFeatureFlag,
    onFeatureFlags: mockOnFeatureFlags,
  })),
  getPostHog: vi.fn().mockImplementation(() => ({
    getFeatureFlag: mockGetFeatureFlag,
    onFeatureFlags: mockOnFeatureFlags,
  })),
  capture: (event: string, props?: Record<string, unknown>) =>
    mockCapture(event, props),
}));

import { PricingClient } from './PricingClient';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('PricingClient', () => {
  beforeEach(() => {
    mockGetFeatureFlag.mockReset();
    mockOnFeatureFlags.mockReset();
    mockOnFeatureFlags.mockImplementation(() => () => {});
    mockCapture.mockReset();
  });

  it('renders the control variant by default (no premium price shown)', async () => {
    mockGetFeatureFlag.mockReturnValue(undefined);

    render(wrap(<PricingClient />));

    await waitFor(() =>
      expect(screen.getByTestId('pricing-variant-control')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('pricing-premium-card')).not.toBeInTheDocument();
    // Price strings must not leak into the control view.
    expect(screen.queryByText(/THB 349/)).not.toBeInTheDocument();
    expect(screen.queryByText(/THB 199/)).not.toBeInTheDocument();
  });

  it('renders variant_a_349 with the THB 349 monthly / THB 3,490 yearly prices', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');

    render(wrap(<PricingClient />));

    await waitFor(() =>
      expect(
        screen.getByTestId('pricing-variant-variant_a_349'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-premium-monthly')).toHaveTextContent(
      'THB 349/month',
    );
    expect(screen.getByText(/THB 3,490\/year/)).toBeInTheDocument();
    // Phase-2 notice must be surfaced so expectations stay honest.
    expect(screen.getByText(/Coming Phase 2/)).toBeInTheDocument();
  });

  it('renders variant_b_199 with the THB 199 monthly / THB 1,990 yearly prices', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_b_199');

    render(wrap(<PricingClient />));

    await waitFor(() =>
      expect(
        screen.getByTestId('pricing-variant-variant_b_199'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId('pricing-premium-monthly')).toHaveTextContent(
      'THB 199/month',
    );
    expect(screen.getByText(/THB 1,990\/year/)).toBeInTheDocument();
  });

  it('emits `pricing_waitlist_joined` with variant + tier when the waitlist form submits', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'created' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(wrap(<PricingClient />));

    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId('pricing-waitlist-email'), {
      target: { value: 'user@example.com' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pricing-waitlist-submit'));
    });

    await waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith(
        'pricing_waitlist_joined',
        expect.objectContaining({
          variant: 'variant_a_349',
          tier: 'premium',
          monthly_price_thb: 349,
          yearly_price_thb: 3490,
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('pricing-waitlist-success')).toBeInTheDocument(),
    );

    // Also confirm we called the local route — it's the stub that will forward
    // to /v1/waitlist when that ships.
    expect(fetchMock).toHaveBeenCalledWith(
      '/pricing/waitlist',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('does not emit the PostHog event before the user types a valid email', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_b_199');

    render(wrap(<PricingClient />));

    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    // Without any email typed, no event should have fired yet.
    expect(mockCapture).not.toHaveBeenCalled();
  });

  // -- W24 follow-up: waitlist response-code branching ----------------------
  //
  // The upstream `POST /v1/waitlist` surfaces 201/204/422/429/503 with
  // distinct meanings; PricingClient must render a different message per
  // status and never re-enable the submit button before the request resolves.

  async function submitWaitlistEmail(email = 'user@example.com') {
    fireEvent.change(screen.getByTestId('pricing-waitlist-email'), {
      target: { value: email },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('pricing-waitlist-submit'));
    });
  }

  it('renders the `created` message when the proxy returns 201 + status:created', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'created' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(wrap(<PricingClient />));
    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    await submitWaitlistEmail('new@example.com');

    await waitFor(() =>
      expect(screen.getByTestId('pricing-waitlist-success')).toBeInTheDocument(),
    );
    const success = screen.getByTestId('pricing-waitlist-success');
    expect(success).toHaveAttribute('data-status', 'created');
    expect(success).toHaveTextContent(/We've saved new@example.com/);
  });

  it('renders the `exists` message when the proxy returns 200 + status:exists (upstream 204)', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'exists' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(wrap(<PricingClient />));
    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    await submitWaitlistEmail('dupe@example.com');

    await waitFor(() =>
      expect(screen.getByTestId('pricing-waitlist-success')).toBeInTheDocument(),
    );
    const success = screen.getByTestId('pricing-waitlist-success');
    expect(success).toHaveAttribute('data-status', 'exists');
    expect(success).toHaveTextContent(/already on the waitlist/i);
  });

  it('renders the `rate_limited` message when the proxy returns 429', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(wrap(<PricingClient />));
    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    await submitWaitlistEmail('spammy@example.com');

    await waitFor(() =>
      expect(screen.getByTestId('pricing-waitlist-error')).toBeInTheDocument(),
    );
    const err = screen.getByTestId('pricing-waitlist-error');
    expect(err).toHaveAttribute('data-status', 'rate_limited');
    expect(err).toHaveTextContent(/5 minutes/);
    // The success banner MUST NOT be rendered on a non-success status.
    expect(
      screen.queryByTestId('pricing-waitlist-success'),
    ).not.toBeInTheDocument();
  });

  it('renders the `invalid` message when the proxy returns 422 for a server-side rejected email', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'invalid' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(wrap(<PricingClient />));
    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    // Use an email the client-side regex accepts so we reach the fetch and
    // the 422 is the one that drives the copy.
    await submitWaitlistEmail('weird+plus@example.com');

    await waitFor(() =>
      expect(screen.getByTestId('pricing-waitlist-error')).toBeInTheDocument(),
    );
    const err = screen.getByTestId('pricing-waitlist-error');
    expect(err).toHaveAttribute('data-status', 'invalid');
    expect(err).toHaveTextContent(/doesn't look right/i);
  });

  it('disables the submit button while the request is in flight and re-enables only after it resolves', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a_349');

    // A deferred fetch so we can observe the in-flight state.
    let resolveFetch: (value: Response) => void = () => {};
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    globalThis.fetch = vi
      .fn()
      .mockReturnValue(fetchPromise) as unknown as typeof fetch;

    render(wrap(<PricingClient />));
    await waitFor(() =>
      expect(screen.getByTestId('pricing-premium-card')).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByTestId('pricing-waitlist-email'), {
      target: { value: 'user@example.com' },
    });

    const submit = screen.getByTestId(
      'pricing-waitlist-submit',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(submit);
    });

    // In flight: the button must be disabled to prevent duplicate submissions.
    expect(submit.disabled).toBe(true);
    expect(submit).toHaveAttribute('aria-busy', 'true');

    // Resolve the fetch with a 201 and let the microtask queue drain so the
    // component transitions out of `submitting`.
    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify({ status: 'created' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('pricing-waitlist-success')).toBeInTheDocument(),
    );
  });
});

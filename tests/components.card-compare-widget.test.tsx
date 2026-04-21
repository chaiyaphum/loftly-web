import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CardCompareWidget } from '@/components/loftly/CardCompareWidget';
import thMessages from '../messages/th.json';
import type { Card, CardComparison } from '@/lib/api/types';

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

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-' + (overrides.slug ?? 'x'),
    slug: 'sample-card',
    display_name: 'Sample Card',
    bank: {
      slug: 'samplebank',
      display_name_en: 'SampleBank',
      display_name_th: 'SampleBank',
    },
    tier: 'Platinum',
    network: 'Visa',
    annual_fee_thb: 2000,
    annual_fee_waiver: null,
    min_income_thb: 30000,
    min_age: 20,
    earn_currency: {
      code: 'K_POINT',
      display_name_en: 'K Point',
      display_name_th: 'K Point',
      currency_type: 'bank_proprietary',
    },
    earn_rate_local: {
      dining: 3,
      online: 2,
      grocery: 1,
      travel: 2,
      petrol: 1,
      default: 1,
    },
    earn_rate_foreign: null,
    benefits: {},
    description_th: null,
    description_en: null,
    status: 'active',
    ...overrides,
  };
}

function makeComparison(overrides: Partial<CardComparison> = {}): CardComparison {
  return {
    card: makeCard(),
    transfer_partners: [],
    valuation: null,
    loftly_score: 4.0,
    ...overrides,
  };
}

describe('CardCompareWidget', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('starts collapsed and does not fetch until expanded', () => {
    const spy = vi.fn();
    globalThis.fetch = spy;

    render(
      wrap(
        <CardCompareWidget sourceSlug="kbank-wisdom" sourceDisplayName="KBank WISDOM" />,
      ),
    );

    const toggle = screen.getByRole('button', { name: /เปรียบเทียบ/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches similar cards on first expand and renders the picker', async () => {
    const similar = {
      data: [
        makeCard({ id: 'c1', slug: 'uob-prvi', display_name: 'UOB PRVI Miles' }),
        makeCard({ id: 'c2', slug: 'ktc-forever', display_name: 'KTC Forever' }),
      ],
    };
    const spy = vi.fn().mockResolvedValue(jsonResponse(200, similar));
    globalThis.fetch = spy;

    render(
      wrap(
        <CardCompareWidget sourceSlug="kbank-wisdom" sourceDisplayName="KBank WISDOM" />,
      ),
    );

    const toggle = screen.getByRole('button', { name: /เปรียบเทียบ/ });
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('UOB PRVI Miles')).toBeInTheDocument();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toContain('/cards/similar/kbank-wisdom');
    expect(url).toContain('limit=5');
  });

  it('caps selection at 2 additional cards and disables further checkboxes', async () => {
    const similar = {
      data: [
        makeCard({ id: 'c1', slug: 'a', display_name: 'Card A' }),
        makeCard({ id: 'c2', slug: 'b', display_name: 'Card B' }),
        makeCard({ id: 'c3', slug: 'c', display_name: 'Card C' }),
      ],
    };
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(200, similar));

    render(
      wrap(
        <CardCompareWidget sourceSlug="source" sourceDisplayName="Source" />,
      ),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /เปรียบเทียบ/ }));
    });
    await waitFor(() => screen.getByLabelText('Card A'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Card A'));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Card B'));
    });

    const third = screen.getByLabelText('Card C') as HTMLInputElement;
    expect(third.disabled).toBe(true);
    expect(screen.getByRole('note').textContent).toMatch(/สูงสุด 2/);
  });

  it('fires /cards/compare with the correct slugs on Compare click', async () => {
    const similar = {
      data: [
        makeCard({ id: 'c1', slug: 'other-card', display_name: 'Other Card' }),
      ],
    };
    const compare = {
      data: [
        makeComparison({
          card: makeCard({
            id: 'source-id',
            slug: 'source',
            display_name: 'Source Card',
          }),
        }),
        makeComparison({
          card: makeCard({
            id: 'c1',
            slug: 'other-card',
            display_name: 'Other Card',
          }),
        }),
      ],
    };

    const spy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, similar))
      .mockResolvedValueOnce(jsonResponse(200, compare));
    globalThis.fetch = spy;

    render(
      wrap(
        <CardCompareWidget sourceSlug="source" sourceDisplayName="Source Card" />,
      ),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /เปรียบเทียบ/ }));
    });
    await waitFor(() => screen.getByLabelText('Other Card'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Other Card'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('compare-submit'));
    });

    await waitFor(() => {
      const table = screen.getByTestId('card-compare-table');
      expect(within(table).getAllByText('Source Card').length).toBeGreaterThan(
        0,
      );
    });

    expect(spy).toHaveBeenCalledTimes(2);
    const compareUrl = spy.mock.calls[1]?.[0] as string;
    expect(compareUrl).toContain('/cards/compare');
    expect(compareUrl).toContain('slugs=source%2Cother-card');
  });

  it('surfaces LoftlyAPIError message_th on similar-fetch failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: 'server_error',
          message_en: 'Internal error',
          message_th: 'เซิร์ฟเวอร์ขัดข้อง',
        },
      }),
    );

    render(
      wrap(<CardCompareWidget sourceSlug="source" sourceDisplayName="S" />),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /เปรียบเทียบ/ }));
    });

    await waitFor(
      () => {
        expect(screen.getByRole('alert').textContent).toContain(
          'เซิร์ฟเวอร์ขัดข้อง',
        );
      },
      { timeout: 3000 },
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../../messages/en.json';

/**
 * Unit coverage for the W17 admin affiliate CSV-export page.
 *
 * We mock `@/lib/api/admin` so the component doesn't try to hit the network,
 * then assert that:
 *  - the export anchor is a GET link whose URL carries `from`, `to`, and the
 *    admin JWT
 *  - the default range is 30 days (inclusive) ending today, mirroring the
 *    backend's default window
 *  - selecting a partner threads `partner_id` into the CSV URL
 *  - toggling "All partners" drops `partner_id` from the URL
 */

const mockGetAffiliateStats = vi.fn();
const mockListAffiliatePartners = vi.fn();

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/api/admin')>();
  return {
    ...actual,
    getAffiliateStats: (...args: unknown[]) => mockGetAffiliateStats(...args),
    listAffiliatePartners: (...args: unknown[]) =>
      mockListAffiliatePartners(...args),
  };
});

import { AdminAffiliateClient } from './AdminAffiliateClient';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('AdminAffiliateClient', () => {
  const FAKE_NOW = new Date('2026-04-21T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
    mockGetAffiliateStats.mockResolvedValue({
      period_days: 30,
      clicks: 123,
      conversions: 10,
      conversion_rate: 0.08,
      commission_pending_thb: 1000,
      commission_confirmed_thb: 2000,
      commission_paid_thb: 3000,
      by_card: [
        {
          card_slug: 'kbank-world-plus',
          clicks: 80,
          conversions: 6,
          commission_thb: 1800,
        },
      ],
    });
    // Simulate the 404 fallback — the hook will swallow and use KNOWN_AFFILIATE_PARTNERS.
    mockListAffiliatePartners.mockResolvedValue([
      { id: 'moneyguru', name: 'MoneyGuru' },
      { id: 'ktc', name: 'KTC' },
      { id: 'uob', name: 'UOB' },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('builds the CSV export URL with the default 30-day range and the admin token', async () => {
    render(wrap(<AdminAffiliateClient accessToken="tok-admin" />));

    const anchor = screen.getByTestId(
      'affiliate-export-csv',
    ) as HTMLAnchorElement;

    const href = anchor.getAttribute('href')!;
    const url = new URL(href);

    expect(url.pathname).toBe('/v1/admin/affiliate/stats.csv');
    expect(url.searchParams.get('token')).toBe('tok-admin');
    expect(url.searchParams.get('partner_id')).toBeNull();

    // Default range spans 30 days ending today (inclusive).
    const expectedTo = isoDate(FAKE_NOW);
    const expectedFromDate = new Date(FAKE_NOW);
    expectedFromDate.setUTCDate(expectedFromDate.getUTCDate() - 29);
    const expectedFrom = isoDate(expectedFromDate);

    expect(url.searchParams.get('to')).toBe(expectedTo);
    expect(url.searchParams.get('from')).toBe(expectedFrom);
  });

  it('threads a single selected partner id into the CSV URL', () => {
    render(wrap(<AdminAffiliateClient accessToken="tok-admin" />));

    // `partners` state is seeded from KNOWN_AFFILIATE_PARTNERS synchronously,
    // so the KTC checkbox is present on first render — no waitFor needed.
    fireEvent.click(screen.getByTestId('partner-ktc'));

    const anchor = screen.getByTestId(
      'affiliate-export-csv',
    ) as HTMLAnchorElement;
    const url = new URL(anchor.href);
    expect(url.searchParams.get('partner_id')).toBe('ktc');
  });

  it('omits partner_id when no partner is selected (all partners)', () => {
    render(wrap(<AdminAffiliateClient accessToken="tok-admin" />));

    // Select then unselect to exercise the toggle.
    fireEvent.click(screen.getByTestId('partner-ktc'));
    fireEvent.click(screen.getByTestId('partner-ktc'));

    const anchor = screen.getByTestId(
      'affiliate-export-csv',
    ) as HTMLAnchorElement;
    const url = new URL(anchor.href);
    expect(url.searchParams.get('partner_id')).toBeNull();
  });

  it('blocks CSV download when the date range exceeds 90 days', () => {
    render(wrap(<AdminAffiliateClient accessToken="tok-admin" />));

    const fromInput = screen.getByTestId('affiliate-from') as HTMLInputElement;
    // Push "from" far into the past — forces a >90-day window.
    fireEvent.change(fromInput, { target: { value: '2025-01-01' } });

    // Range error banner appears synchronously on re-render — no async wait.
    expect(screen.getByTestId('affiliate-range-error')).toBeInTheDocument();

    const anchor = screen.getByTestId(
      'affiliate-export-csv',
    ) as HTMLAnchorElement;
    // The anchor is marked aria-disabled and its onClick preventDefault's.
    expect(anchor.getAttribute('aria-disabled')).toBe('true');
  });
});

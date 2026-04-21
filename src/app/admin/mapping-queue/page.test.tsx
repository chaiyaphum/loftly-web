import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MappingQueueItem } from '@/lib/api/admin';

/**
 * Unit coverage for the admin mapping-queue page (W11 bulk-assign UX).
 *
 * Three cases:
 *   1. Checkbox selects a single row → the bulk bar appears with count 1.
 *   2. Selecting 3 rows + picking a card + clicking "Assign" loops
 *      `assignMappingQueueItem` three times.
 *   3. Changing the unresolved-days filter hides rows newer than the
 *      threshold (7d / 14d / 30d / all).
 */

const mockGetAdminSession = vi.fn();
const mockListMappingQueue = vi.fn();
const mockListAdminCards = vi.fn();
const mockApiFetch = vi.fn();
const mockRedirect = vi.fn();
const mockRefresh = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getAdminSession: () => mockGetAdminSession(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error('REDIRECTED');
  },
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock only the top-level fetchers used by the server component. The bulk
// helper (`bulkAssignMappingQueueItems`) calls `apiFetch` directly rather than
// re-using `assignMappingQueueItem`, so a single mock at the `apiFetch`
// boundary covers every per-row POST the bulk loop issues.
vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>();
  return {
    ...actual,
    listMappingQueue: (...args: unknown[]) => mockListMappingQueue(...args),
    listAdminCards: (...args: unknown[]) => mockListAdminCards(...args),
  };
});

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

// PostHog consent check reads document.cookie. In jsdom the consent cookie is
// absent → the event is silently dropped, which is the path we want under test.
vi.mock('@/lib/posthog', () => ({
  capture: vi.fn(),
  loadPostHog: vi.fn(),
  optIn: vi.fn(),
  optOut: vi.fn(),
}));

import AdminMappingQueuePage from './page';

function makeItem(overrides: Partial<MappingQueueItem> = {}): MappingQueueItem {
  return {
    promo_id: `promo-${Math.random().toString(36).slice(2, 9)}`,
    title_th: 'Test promo',
    bank_slug: 'kbank',
    card_types_raw: ['visa-platinum'],
    suggested_card_ids: [],
    last_synced_at: null,
    ...overrides,
  };
}

describe('AdminMappingQueuePage', () => {
  beforeEach(() => {
    mockGetAdminSession.mockReset();
    mockListMappingQueue.mockReset();
    mockListAdminCards.mockReset();
    mockApiFetch.mockReset();
    mockRedirect.mockClear();
    mockRefresh.mockClear();
    mockGetAdminSession.mockResolvedValue({
      accessToken: 'tok-admin',
      role: 'admin',
    });
    mockListAdminCards.mockResolvedValue({
      data: [
        {
          id: 'card-111',
          display_name: 'KBank Wisdom',
          bank: { slug: 'kbank' },
          slug: 'kbank-wisdom',
          network: 'Visa',
          earn_rate_local: {},
          benefits: {},
          status: 'active',
          earn_currency: { code: 'THB' },
        },
        {
          id: 'card-222',
          display_name: 'SCB M Legend',
          bank: { slug: 'scb' },
          slug: 'scb-m-legend',
          network: 'Mastercard',
          earn_rate_local: {},
          benefits: {},
          status: 'active',
          earn_currency: { code: 'THB' },
        },
      ],
      pagination: { has_more: false },
    });
    mockApiFetch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('toggling a single row checkbox opens the bulk bar for 1 promo', async () => {
    const item = makeItem({ promo_id: 'p-1', title_th: 'Promo One' });
    mockListMappingQueue.mockResolvedValue({ data: [item], total: 1 });

    const ui = await AdminMappingQueuePage();
    render(ui);

    // Bulk bar is hidden by default — no selection yet.
    expect(
      screen.queryByTestId('mapping-queue-bulk-bar'),
    ).not.toBeInTheDocument();

    const checkbox = screen.getByTestId('mapping-queue-row-checkbox-p-1');
    fireEvent.click(checkbox);

    const bar = await screen.findByTestId('mapping-queue-bulk-bar');
    expect(bar).toHaveTextContent(/Assign to 1 promo/i);
  });

  it('bulk-assigning 3 selected rows fires the per-row endpoint 3 times', async () => {
    const items = [
      makeItem({ promo_id: 'p-a', title_th: 'A' }),
      makeItem({ promo_id: 'p-b', title_th: 'B' }),
      makeItem({ promo_id: 'p-c', title_th: 'C' }),
    ];
    mockListMappingQueue.mockResolvedValue({ data: items, total: 3 });

    const ui = await AdminMappingQueuePage();
    render(ui);

    fireEvent.click(screen.getByTestId('mapping-queue-row-checkbox-p-a'));
    fireEvent.click(screen.getByTestId('mapping-queue-row-checkbox-p-b'));
    fireEvent.click(screen.getByTestId('mapping-queue-row-checkbox-p-c'));

    const bar = await screen.findByTestId('mapping-queue-bulk-bar');
    expect(bar).toHaveTextContent(/Assign to 3 promos/i);

    const picker = screen.getByTestId(
      'mapping-queue-card-picker',
    ) as HTMLInputElement;
    // Typing the display_name triggers the datalist match path, which locks
    // in the card ID under the hood.
    fireEvent.change(picker, { target: { value: 'KBank Wisdom' } });

    const assignBtn = screen.getByTestId('mapping-queue-bulk-assign');
    expect(assignBtn).not.toBeDisabled();
    fireEvent.click(assignBtn);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(3);
    });
    // Each call POSTs to the per-row assign endpoint with the picked card.
    const paths = mockApiFetch.mock.calls.map((c) => c[0] as string);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/admin/mapping-queue/p-a/assign',
        '/admin/mapping-queue/p-b/assign',
        '/admin/mapping-queue/p-c/assign',
      ]),
    );
    for (const call of mockApiFetch.mock.calls) {
      const opts = call[1] as { method: string; body: { card_ids: string[] } };
      expect(opts.method).toBe('POST');
      expect(opts.body).toEqual({ card_ids: ['card-111'] });
    }
  });

  it('changing the unresolved-days filter hides rows newer than the threshold', async () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const items = [
      makeItem({
        promo_id: 'p-fresh',
        title_th: 'Fresh promo',
        last_synced_at: new Date(now - 2 * dayMs).toISOString(),
      }),
      makeItem({
        promo_id: 'p-stale',
        title_th: 'Stale promo',
        last_synced_at: new Date(now - 20 * dayMs).toISOString(),
      }),
    ];
    mockListMappingQueue.mockResolvedValue({ data: items, total: 2 });

    const ui = await AdminMappingQueuePage();
    render(ui);

    // Default is "All" → both rows visible.
    expect(
      screen.getByTestId('mapping-queue-row-p-fresh'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('mapping-queue-row-p-stale'),
    ).toBeInTheDocument();

    const select = screen.getByTestId(
      'mapping-queue-days-filter',
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '14' } });

    await waitFor(() => {
      expect(
        screen.queryByTestId('mapping-queue-row-p-fresh'),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByTestId('mapping-queue-row-p-stale'),
    ).toBeInTheDocument();
    // Counter reflects the filtered set.
    expect(screen.getByTestId('mapping-queue-count')).toHaveTextContent('1 / 2');
  });
});

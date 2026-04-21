import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WaitlistEntry, WaitlistList } from '@/lib/api/admin';

/**
 * Page tests for `/admin/waitlist`.
 *
 * The server component is async — we `await` it to get a React tree. We mock
 * `listWaitlist` so the server + client branches can assert against known
 * payloads; the source-filter test re-runs the call from the client on change.
 */

const mockGetAdminSession = vi.fn();
const mockListWaitlist = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  getAdminSession: () => mockGetAdminSession(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error('REDIRECTED');
  },
}));

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>();
  return {
    ...actual,
    listWaitlist: (...args: unknown[]) => mockListWaitlist(...args),
  };
});

import AdminWaitlistPage from './page';

function makeEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: 'wl-1',
    email: 'a@example.com',
    source: 'pricing',
    variant: 'B',
    tier: 'pro',
    monthly_price_thb: 199,
    created_at: '2026-04-21T10:00:00Z',
    ...overrides,
  };
}

function makeList(
  entries: WaitlistEntry[],
  has_more = false,
): WaitlistList {
  return {
    data: entries,
    pagination: { has_more },
  };
}

describe('AdminWaitlistPage', () => {
  beforeEach(() => {
    mockGetAdminSession.mockReset();
    mockListWaitlist.mockReset();
    mockRedirect.mockClear();
    mockGetAdminSession.mockResolvedValue({
      accessToken: 'tok-admin',
      role: 'admin',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the empty state when there are no signups', async () => {
    mockListWaitlist.mockResolvedValue(makeList([], false));

    const ui = await AdminWaitlistPage({});
    render(ui);

    expect(screen.getByTestId('admin-waitlist-page')).toBeInTheDocument();
    expect(screen.getByTestId('admin-waitlist-table')).toBeInTheDocument();
    expect(screen.getByTestId('admin-waitlist-empty')).toHaveTextContent(
      /no signups/i,
    );
    // No "Load more" button when backend says there's nothing left.
    expect(
      screen.queryByTestId('admin-waitlist-load-more'),
    ).not.toBeInTheDocument();
  });

  it('renders a full page of rows and shows Load more when has_more', async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      makeEntry({ id: `wl-${i}`, email: `u${i}@ex.com` }),
    );
    mockListWaitlist.mockResolvedValue(makeList(rows, true));

    const ui = await AdminWaitlistPage({});
    render(ui);

    // 50 row test ids present.
    expect(screen.getByTestId('admin-waitlist-row-wl-0')).toBeInTheDocument();
    expect(screen.getByTestId('admin-waitlist-row-wl-49')).toBeInTheDocument();
    expect(
      screen.queryByTestId('admin-waitlist-empty'),
    ).not.toBeInTheDocument();

    // Load more button is visible because has_more = true.
    expect(
      screen.getByTestId('admin-waitlist-load-more'),
    ).toBeInTheDocument();

    // Summary shows the count.
    expect(screen.getByTestId('admin-waitlist-summary')).toHaveTextContent(
      /50 shown/,
    );
  });

  it('changing the source filter re-fetches with ?source=pricing', async () => {
    // Initial SSR load (no source filter).
    mockListWaitlist.mockResolvedValueOnce(
      makeList([makeEntry({ id: 'wl-init' })], false),
    );
    // Client-side re-fetch after switching to "pricing".
    mockListWaitlist.mockResolvedValueOnce(
      makeList(
        [makeEntry({ id: 'wl-p', source: 'pricing' })],
        false,
      ),
    );

    const ui = await AdminWaitlistPage({});
    render(ui);

    // Initial call: no source supplied.
    expect(mockListWaitlist).toHaveBeenCalledTimes(1);
    const firstCallOpts = mockListWaitlist.mock.calls[0]?.[1] as {
      source?: string;
      limit?: number;
      offset?: number;
    };
    expect(firstCallOpts.source).toBeUndefined();
    expect(firstCallOpts.limit).toBe(50);
    expect(firstCallOpts.offset).toBe(0);

    // Change the filter to pricing.
    const select = screen.getByTestId('admin-waitlist-source-filter');
    fireEvent.change(select, { target: { value: 'pricing' } });

    await waitFor(() => {
      expect(mockListWaitlist).toHaveBeenCalledTimes(2);
    });
    const secondCallOpts = mockListWaitlist.mock.calls[1]?.[1] as {
      source?: string;
      limit?: number;
      offset?: number;
    };
    expect(secondCallOpts.source).toBe('pricing');
    expect(secondCallOpts.offset).toBe(0);

    // Row from the second fetch is rendered.
    await waitFor(() => {
      expect(
        screen.getByTestId('admin-waitlist-row-wl-p'),
      ).toBeInTheDocument();
    });
  });
});

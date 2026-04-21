import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Page test for `/admin/ingestion` (W16 catalog viewer).
 *
 * The server component is async — we `await` it to get a React tree, then
 * rely on testing-library for the rendered DOM. Because the page currently
 * runs on stub data we don't mock `getIngestionCoverage` for the happy-path
 * test; we do mock `resyncBankIngestion` to verify the button POSTs and
 * surfaces the 404-missing-endpoint message when the backend isn't live.
 */

const mockGetAdminSession = vi.fn();
const mockResyncBankIngestion = vi.fn();
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
    resyncBankIngestion: (...args: unknown[]) =>
      mockResyncBankIngestion(...args),
  };
});

import AdminIngestionPage from './page';

describe('AdminIngestionPage', () => {
  beforeEach(() => {
    mockGetAdminSession.mockReset();
    mockResyncBankIngestion.mockReset();
    mockRedirect.mockClear();
    mockGetAdminSession.mockResolvedValue({
      accessToken: 'tok-admin',
      role: 'admin',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the summary + bank rows from the stub coverage snapshot', async () => {
    const ui = await AdminIngestionPage();
    render(ui);

    // Summary present.
    expect(screen.getByTestId('admin-ingestion-summary')).toBeInTheDocument();
    expect(screen.getByTestId('admin-ingestion-overall-pct')).toHaveTextContent(
      '72.0%',
    );
    expect(screen.getByTestId('admin-ingestion-unmapped')).toHaveTextContent(
      '3',
    );

    // Stub banner visible because no backend yet.
    expect(
      screen.getByTestId('admin-ingestion-stub-banner'),
    ).toBeInTheDocument();

    // Table + at least three known banks from the stub.
    expect(screen.getByTestId('admin-ingestion-table')).toBeInTheDocument();
    expect(
      screen.getByTestId('admin-ingestion-row-kbank'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('admin-ingestion-row-uob')).toBeInTheDocument();
    expect(screen.getByTestId('admin-ingestion-row-citi')).toBeInTheDocument();
  });

  it('renders the correct coverage badge status per bank', async () => {
    const ui = await AdminIngestionPage();
    render(ui);

    expect(
      screen.getByTestId('admin-ingestion-badge-kbank'),
    ).toHaveAttribute('data-status', 'full');
    expect(
      screen.getByTestId('admin-ingestion-badge-uob'),
    ).toHaveAttribute('data-status', 'partial');
    expect(
      screen.getByTestId('admin-ingestion-badge-citi'),
    ).toHaveAttribute('data-status', 'gap');
  });

  it('fires a re-sync POST when the button is clicked', async () => {
    mockResyncBankIngestion.mockResolvedValue({ ok: true });
    const ui = await AdminIngestionPage();
    render(ui);

    const btn = screen.getByTestId('admin-ingestion-resync-uob');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockResyncBankIngestion).toHaveBeenCalledWith(
        'uob',
        'tok-admin',
      );
    });
  });

  it('surfaces the missing-endpoint message when resync 404s', async () => {
    mockResyncBankIngestion.mockRejectedValue(
      new LoftlyAPIError({
        code: 'not_found',
        message_en: 'Not found',
        status: 404,
      }),
    );
    const ui = await AdminIngestionPage();
    render(ui);

    fireEvent.click(screen.getByTestId('admin-ingestion-resync-ktc'));

    await waitFor(() => {
      expect(
        screen.getByTestId('admin-ingestion-resync-error-ktc'),
      ).toHaveTextContent(/endpoint not live/i);
    });
  });

  it('redirects to onboarding when there is no admin session', async () => {
    mockGetAdminSession.mockResolvedValue(null);

    await expect(AdminIngestionPage()).rejects.toThrow('REDIRECTED');
    expect(mockRedirect).toHaveBeenCalledWith(
      '/onboarding?next=/admin/ingestion',
    );
  });
});

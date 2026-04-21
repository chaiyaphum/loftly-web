import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../../messages/en.json';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * `/account` settings landing page tests.
 *
 * Covers:
 *   1. Unauthed users redirect to `/onboarding?next=/account` and never
 *      hit the `/v1/me` endpoint.
 *   2. All three cards (consent / data-export / delete) render when the
 *      user is signed in.
 *   3. The hero shows the signed-in email when `/v1/me` returns a profile.
 */

const mockGetSession = vi.fn();
const mockGetMe = vi.fn();
const mockRedirect = vi.fn((...args: unknown[]): never => {
  void args;
  throw new Error('REDIRECTED');
});

vi.mock('@/lib/auth/session', () => ({
  getSession: () => mockGetSession(),
}));

vi.mock('@/lib/api/me', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/me')>();
  return {
    ...actual,
    getMe: (...args: unknown[]) => mockGetMe(...args),
  };
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (scope: string) => makeT(scope),
}));

function makeT(scope: string) {
  const dict = enMessages as unknown as Record<string, unknown>;
  const segments = scope.split('.');
  let node: unknown = dict;
  for (const seg of segments) {
    node = (node as Record<string, unknown>)?.[seg];
  }
  const t = (key: string) => {
    const parts = key.split('.');
    let value: unknown = node;
    for (const p of parts) {
      value = (value as Record<string, unknown>)?.[p];
    }
    return typeof value === 'string' ? value : key;
  };
  return t;
}

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('AccountPage', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetMe.mockReset();
    mockRedirect.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to /onboarding?next=/account when there is no session', async () => {
    mockGetSession.mockResolvedValue(null);

    const { default: AccountPage } = await import('./page');
    await expect(AccountPage()).rejects.toThrow('REDIRECTED');
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding?next=/account');
    // Must NOT fetch /me when the user is unauthed — protects against
    // leaking an unauthenticated request upstream.
    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it('renders the three settings cards (consent / data-export / delete)', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok', role: 'user' });
    mockGetMe.mockResolvedValue({
      email: 'user@example.com',
      created_at: '2025-10-01T00:00:00Z',
      last_login_at: '2026-04-20T12:00:00Z',
    });

    const { default: AccountPage } = await import('./page');
    const ui = await AccountPage();
    render(wrap(ui));

    const consent = screen.getByTestId('account-card-consent');
    expect(consent).toHaveAttribute('href', '/account/consent');
    expect(consent).toHaveTextContent('Data consents');

    const exportCard = screen.getByTestId('account-card-data-export');
    expect(exportCard).toHaveAttribute('href', '/account/data-export');

    const del = screen.getByTestId('account-card-delete');
    expect(del).toHaveAttribute('href', '/account/delete');
    expect(del).toHaveTextContent('Delete account');

    // Sign-out form is present and posts to the logout route.
    const signOut = screen.getByTestId('account-sign-out');
    expect(signOut).toBeInTheDocument();
    expect(signOut.closest('form')).toHaveAttribute(
      'action',
      '/api/auth/logout',
    );
  });

  it('renders the signed-in email in the hero when /v1/me returns a profile', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok', role: 'user' });
    mockGetMe.mockResolvedValue({
      email: 'user@example.com',
      created_at: '2025-10-01T00:00:00Z',
      last_login_at: '2026-04-20T12:00:00Z',
    });

    const { default: AccountPage } = await import('./page');
    const ui = await AccountPage();
    render(wrap(ui));

    expect(screen.getByTestId('account-hero-email')).toHaveTextContent(
      'user@example.com',
    );
    // Signup + last login labels render when /v1/me includes them.
    expect(screen.getByTestId('account-hero-since')).toBeInTheDocument();
    expect(screen.getByTestId('account-hero-last-login')).toBeInTheDocument();
    // Error banner must NOT appear on the happy path.
    expect(screen.queryByTestId('account-hero-error')).not.toBeInTheDocument();
  });

  it('shows the load-error banner when /v1/me fails (endpoint not live yet)', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok', role: 'user' });
    mockGetMe.mockRejectedValue(
      new LoftlyAPIError({
        code: 'not_found',
        message_en: 'Not found',
        status: 404,
      }),
    );

    const { default: AccountPage } = await import('./page');
    const ui = await AccountPage();
    render(wrap(ui));

    expect(screen.getByTestId('account-hero-error')).toBeInTheDocument();
    // Cards must still render — the landing page remains usable without /me.
    expect(screen.getByTestId('account-card-consent')).toBeInTheDocument();
    expect(screen.getByTestId('account-card-data-export')).toBeInTheDocument();
    expect(screen.getByTestId('account-card-delete')).toBeInTheDocument();
  });
});

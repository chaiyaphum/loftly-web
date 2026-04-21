import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StaleArticlesTable } from '@/components/admin/StaleArticlesTable';
import type { StaleArticle, StalePagination } from '@/lib/api/admin';

/**
 * Unit test for the stale-articles table component.
 *
 * We test the interaction path (click → confirm → POST → row button flips to
 * "Marked") rather than the server-component layout, because the outer
 * `/admin/articles/stale/page.tsx` is an `async` RSC that depends on
 * `getAdminSession` — that's covered by e2e smoke tests, not this unit file.
 *
 * Mocks: the `next/navigation` `router.refresh` (no-op — the test doesn't
 * re-fetch) and `globalThis.fetch` for the `markArticleReviewed` POST.
 */

const originalFetch = globalThis.fetch;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeItem(overrides: Partial<StaleArticle> = {}): StaleArticle {
  return {
    id: 'a-1',
    slug: 'kbank-wisdom-review',
    title_th: 'รีวิวบัตร KBank WISDOM',
    state: 'published',
    updated_at: '2026-01-01T00:00:00Z',
    policy_version: '2026-04-01',
    card: {
      id: 'c-1',
      slug: 'kbank-wisdom',
      display_name: 'KBank WISDOM',
    },
    bank: {
      slug: 'kbank',
      display_name_en: 'KBank',
      display_name_th: 'กสิกรไทย',
    },
    last_reviewed_by: null,
    ...overrides,
  };
}

const pagination: StalePagination = {
  page: 1,
  page_size: 20,
  total: 1,
  has_more: false,
};

describe('StaleArticlesTable', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders card name, issuer, article title, and a Mark reviewed button', () => {
    render(
      <StaleArticlesTable
        items={[makeItem()]}
        pagination={pagination}
        currentQuery={{ days: 90, state: 'published', issuer: '', page: 1 }}
        accessToken="tok-admin"
      />,
    );

    expect(screen.getByText('KBank WISDOM')).toBeInTheDocument();
    expect(screen.getByText('KBank')).toBeInTheDocument();
    expect(screen.getByText('รีวิวบัตร KBank WISDOM')).toBeInTheDocument();
    expect(screen.getByTestId('mark-reviewed-a-1')).toBeInTheDocument();
    expect(screen.getByText('Open article')).toBeInTheDocument();
  });

  it('shows the empty state when the list is empty', () => {
    render(
      <StaleArticlesTable
        items={[]}
        pagination={{ ...pagination, total: 0 }}
        currentQuery={{ days: 90, state: 'published', issuer: '', page: 1 }}
        accessToken="tok-admin"
      />,
    );
    expect(screen.getByText(/Nothing is stale/i)).toBeInTheDocument();
  });

  it('opens the confirm modal, POSTs to mark-reviewed, then flips the button to Marked', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {
          id: 'a-1',
          slug: 'kbank-wisdom-review',
          state: 'published',
          updated_at: new Date().toISOString(),
        }),
      );
    globalThis.fetch = spy;

    render(
      <StaleArticlesTable
        items={[makeItem()]}
        pagination={pagination}
        currentQuery={{ days: 90, state: 'published', issuer: '', page: 1 }}
        accessToken="tok-admin"
      />,
    );

    // Modal isn't open yet.
    expect(screen.queryByTestId('mark-confirm-modal')).toBeNull();

    fireEvent.click(screen.getByTestId('mark-reviewed-a-1'));
    expect(screen.getByTestId('mark-confirm-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('mark-confirm-yes'));
    });

    // Verify the POST hit the right endpoint.
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    const call = spy.mock.calls[0];
    expect(call?.[0]).toContain('/admin/articles/a-1/mark-reviewed');
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(
      (init.headers as Record<string, string>)['Authorization'],
    ).toBe('Bearer tok-admin');

    // Button flips to "Marked".
    await waitFor(() => {
      expect(screen.getByTestId('mark-reviewed-a-1')).toHaveTextContent(
        'Marked',
      );
    });
  });

  it('surfaces a row-level error if the POST fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: 'server_error',
          message_en: 'Something went wrong',
        },
      }),
    );

    render(
      <StaleArticlesTable
        items={[makeItem()]}
        pagination={pagination}
        currentQuery={{ days: 90, state: 'published', issuer: '', page: 1 }}
        accessToken="tok-admin"
      />,
    );
    fireEvent.click(screen.getByTestId('mark-reviewed-a-1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('mark-confirm-yes'));
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it("shows 'Never' when an article has no last_reviewed_by audit row", () => {
    render(
      <StaleArticlesTable
        items={[makeItem({ last_reviewed_by: null })]}
        pagination={pagination}
        currentQuery={{ days: 90, state: 'published', issuer: '', page: 1 }}
        accessToken="tok-admin"
      />,
    );
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('shows the reviewer email when last_reviewed_by is populated', () => {
    render(
      <StaleArticlesTable
        items={[
          makeItem({
            last_reviewed_by: {
              actor_id: 'u-1',
              actor_email: 'admin@loftly.test',
              reviewed_at: '2026-03-01T00:00:00Z',
            },
          }),
        ]}
        pagination={pagination}
        currentQuery={{ days: 90, state: 'published', issuer: '', page: 1 }}
        accessToken="tok-admin"
      />,
    );
    expect(screen.getByText('admin@loftly.test')).toBeInTheDocument();
  });
});

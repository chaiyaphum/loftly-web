'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  markArticleReviewed,
  type StaleArticle,
  type StalePagination,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';

interface Props {
  items: StaleArticle[];
  pagination: StalePagination;
  currentQuery: {
    days: number;
    state: string;
    issuer: string;
    page: number;
  };
  accessToken: string;
}

/** Render a relative + absolute timestamp pair, e.g. "120 days ago · 2025-12-22". */
function formatUpdated(iso: string | null): {
  relative: string;
  absolute: string;
} {
  if (!iso) return { relative: '—', absolute: '—' };
  const when = new Date(iso);
  const diffMs = Date.now() - when.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const absolute = when.toISOString().slice(0, 10);
  return { relative: `${days} days ago`, absolute };
}

export function StaleArticlesTable({
  items,
  pagination,
  currentQuery,
  accessToken,
}: Props) {
  const router = useRouter();
  // Row-level state: tracks which article IDs are mid-request or done.
  const [rowStatus, setRowStatus] = React.useState<
    Record<string, 'idle' | 'saving' | 'done' | 'error'>
  >({});
  const [rowError, setRowError] = React.useState<Record<string, string>>({});
  const [confirmFor, setConfirmFor] = React.useState<string | null>(null);

  async function handleMark(id: string) {
    setRowStatus((s) => ({ ...s, [id]: 'saving' }));
    setRowError((e) => ({ ...e, [id]: '' }));
    try {
      await markArticleReviewed(id, accessToken);
      setRowStatus((s) => ({ ...s, [id]: 'done' }));
      setConfirmFor(null);
      // Refresh the server component so the row drops off the list.
      router.refresh();
    } catch (err) {
      setRowStatus((s) => ({ ...s, [id]: 'error' }));
      setRowError((e) => ({
        ...e,
        [id]:
          err instanceof LoftlyAPIError ? err.message_en : (err as Error).message,
      }));
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-loftly-divider p-6 text-sm text-loftly-ink-muted">
        Nothing is stale right now.
      </p>
    );
  }

  function buildPageHref(nextPage: number): string {
    const params = new URLSearchParams();
    params.set('days', String(currentQuery.days));
    params.set('state', currentQuery.state);
    if (currentQuery.issuer) params.set('issuer', currentQuery.issuer);
    params.set('page', String(nextPage));
    return `/admin/articles/stale?${params.toString()}`;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.page_size),
  );

  return (
    <div className="space-y-4">
      <div className="overflow-auto rounded-md border border-loftly-divider bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-loftly-teal-soft/40 text-left text-xs uppercase tracking-wide text-loftly-ink-muted">
            <tr>
              <th className="px-4 py-2">Card</th>
              <th className="px-4 py-2">Issuer</th>
              <th className="px-4 py-2">Article</th>
              <th className="px-4 py-2">Updated</th>
              <th className="px-4 py-2">Last reviewed</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((a) => {
              const { relative, absolute } = formatUpdated(a.updated_at);
              const status = rowStatus[a.id] ?? 'idle';
              return (
                <tr key={a.id} data-testid={`stale-row-${a.id}`}>
                  <td className="px-4 py-2 font-medium">
                    {a.card?.display_name ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-loftly-ink-muted">
                    {a.bank?.display_name_en ?? a.bank?.slug ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-loftly-ink">{a.title_th}</td>
                  <td className="px-4 py-2 text-xs text-loftly-ink-muted">
                    <span title={absolute}>{relative}</span>
                    <br />
                    <span className="text-loftly-ink-muted/70">{absolute}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-loftly-ink-muted">
                    {a.last_reviewed_by ? (
                      <>
                        <span>{a.last_reviewed_by.actor_email}</span>
                        <br />
                        <span className="text-loftly-ink-muted/70">
                          {a.last_reviewed_by.reviewed_at?.slice(0, 10)}
                        </span>
                      </>
                    ) : (
                      <span className="text-loftly-ink-muted/70">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/admin/articles/${a.id}`}
                        className="text-xs text-loftly-teal hover:underline"
                      >
                        Open article
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmFor(a.id)}
                        disabled={status === 'saving' || status === 'done'}
                        data-testid={`mark-reviewed-${a.id}`}
                        className="rounded-md bg-loftly-teal px-3 py-1 text-xs font-medium text-white hover:bg-loftly-teal/90 disabled:opacity-50"
                      >
                        {status === 'saving'
                          ? 'Marking…'
                          : status === 'done'
                            ? 'Marked'
                            : 'Mark reviewed'}
                      </button>
                    </div>
                    {rowError[a.id] ? (
                      <p
                        role="alert"
                        className="mt-1 text-xs text-loftly-danger"
                      >
                        {rowError[a.id]}
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-loftly-ink-muted">
            Page {pagination.page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {pagination.page > 1 ? (
              <Link
                href={buildPageHref(pagination.page - 1)}
                className="rounded-md border border-loftly-divider px-3 py-1 text-xs hover:bg-loftly-teal-soft/40"
              >
                ← Prev
              </Link>
            ) : null}
            {pagination.has_more ? (
              <Link
                href={buildPageHref(pagination.page + 1)}
                className="rounded-md border border-loftly-divider px-3 py-1 text-xs hover:bg-loftly-teal-soft/40"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}

      {confirmFor ? (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="mark-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Mark article as reviewed?</h2>
            <p className="text-sm text-loftly-ink-muted">
              This bumps updated_at and logs an audit entry — use it after
              you&apos;ve verified earn rates, valuation, and signup bonus
              against the bank&apos;s current site.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmFor(null)}
                className="rounded-md border border-loftly-divider px-4 py-2 text-sm hover:bg-loftly-teal-soft/40"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="mark-confirm-yes"
                onClick={() => void handleMark(confirmFor)}
                className="rounded-md bg-loftly-teal px-4 py-2 text-sm font-medium text-white hover:bg-loftly-teal/90"
              >
                Yes, mark reviewed
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

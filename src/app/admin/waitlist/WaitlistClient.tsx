'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import {
  listWaitlist,
  type WaitlistEntry,
  type WaitlistSource,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Client-side waitlist table.
 *
 * Responsibilities:
 *   - Source filter dropdown (re-fetches page 0 on change).
 *   - "Load more" pagination (offset += pageSize until `has_more === false`).
 *   - CSV export: walks all pages in the current filter, builds the CSV on the
 *     client, and triggers download via a blob URL.
 *
 * CSV export hits the same `/admin/waitlist` endpoint — there is no dedicated
 * `.csv` endpoint yet, so we assemble rows in-memory. This is fine at MVP scale
 * (low-thousands of rows); once we outgrow this we'll ship a server-side
 * streamed export.
 */

export interface WaitlistClientLabels {
  filterSource: string;
  filterAll: string;
  filterPricing: string;
  filterComingSoon: string;
  loadMore: string;
  loadingMore: string;
  exportCsv: string;
  exporting: string;
  exportError: string;
  emptyState: string;
  loadError: string;
  summaryShown: (count: number) => string;
  columns: {
    createdAt: string;
    email: string;
    source: string;
    variant: string;
    tier: string;
    monthlyPriceThb: string;
  };
}

export interface WaitlistClientProps {
  accessToken: string;
  initialEntries: WaitlistEntry[];
  initialHasMore: boolean;
  initialSource: WaitlistSource | undefined;
  pageSize: number;
  labels: WaitlistClientLabels;
}

type SourceFilterValue = 'all' | WaitlistSource;

const CSV_COLUMNS: ReadonlyArray<keyof WaitlistEntry> = [
  'created_at',
  'email',
  'source',
  'variant',
  'tier',
  'monthly_price_thb',
];

export function WaitlistClient({
  accessToken,
  initialEntries,
  initialHasMore,
  initialSource,
  pageSize,
  labels,
}: WaitlistClientProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [source, setSource] = useState<SourceFilterValue>(
    initialSource ?? 'all',
  );
  const [loadingMore, startLoadMore] = useTransition();
  const [exporting, startExport] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const breakdown = useMemo(() => {
    const counts = { pricing: 0, 'coming-soon': 0, other: 0 };
    for (const e of entries) {
      if (e.source === 'pricing') counts.pricing += 1;
      else if (e.source === 'coming-soon') counts['coming-soon'] += 1;
      else counts.other += 1;
    }
    return counts;
  }, [entries]);

  const applyFilter = useCallback(
    (nextSource: SourceFilterValue) => {
      setSource(nextSource);
      setLoadError(null);
      startLoadMore(async () => {
        try {
          const list = await listWaitlist(accessToken, {
            source:
              nextSource === 'all' ? undefined : (nextSource as WaitlistSource),
            limit: pageSize,
            offset: 0,
          });
          setEntries(list.data);
          setHasMore(list.pagination.has_more);
        } catch (err) {
          setLoadError(
            err instanceof LoftlyAPIError ? err.message_en : labels.loadError,
          );
        }
      });
    },
    [accessToken, pageSize, labels.loadError],
  );

  const handleLoadMore = useCallback(() => {
    setLoadError(null);
    startLoadMore(async () => {
      try {
        const list = await listWaitlist(accessToken, {
          source: source === 'all' ? undefined : (source as WaitlistSource),
          limit: pageSize,
          offset: entries.length,
        });
        setEntries((prev) => [...prev, ...list.data]);
        setHasMore(list.pagination.has_more);
      } catch (err) {
        setLoadError(
          err instanceof LoftlyAPIError ? err.message_en : labels.loadError,
        );
      }
    });
  }, [accessToken, entries.length, pageSize, source, labels.loadError]);

  const handleExport = useCallback(() => {
    setExportError(null);
    startExport(async () => {
      try {
        const all: WaitlistEntry[] = [];
        let offset = 0;
        // Walk every page for the current filter. Backend caps limit at 100,
        // so we use the larger page size to minimise round trips.
        const exportPageSize = 100;
        for (;;) {
          const list = await listWaitlist(accessToken, {
            source:
              source === 'all' ? undefined : (source as WaitlistSource),
            limit: exportPageSize,
            offset,
          });
          all.push(...list.data);
          if (!list.pagination.has_more || list.data.length === 0) break;
          offset += list.data.length;
        }

        const csv = buildCsv(all);
        const filename = buildFilename(source);
        triggerDownload(csv, filename);
      } catch (err) {
        setExportError(
          err instanceof LoftlyAPIError ? err.message_en : labels.exportError,
        );
      }
    });
  }, [accessToken, source, labels.exportError]);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center justify-between gap-3"
        data-testid="admin-waitlist-controls"
      >
        <div className="flex items-center gap-3">
          <label
            htmlFor="waitlist-source"
            className="text-sm font-medium text-loftly-ink"
          >
            {labels.filterSource}
          </label>
          <select
            id="waitlist-source"
            value={source}
            onChange={(ev) =>
              applyFilter(ev.target.value as SourceFilterValue)
            }
            className="rounded-md border border-loftly-divider bg-white px-2 py-1 text-sm"
            data-testid="admin-waitlist-source-filter"
          >
            <option value="all">{labels.filterAll}</option>
            <option value="pricing">{labels.filterPricing}</option>
            <option value="coming-soon">{labels.filterComingSoon}</option>
          </select>
          <span
            className="text-sm text-loftly-ink-muted"
            data-testid="admin-waitlist-summary"
          >
            {labels.summaryShown(entries.length)} · pricing:{' '}
            {breakdown.pricing} · coming-soon: {breakdown['coming-soon']}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || entries.length === 0}
          className="rounded-md border border-loftly-divider bg-white px-3 py-1.5 text-sm font-medium text-loftly-ink hover:bg-loftly-teal-soft/40 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="admin-waitlist-export"
        >
          {exporting ? labels.exporting : labels.exportCsv}
        </button>
      </div>

      {exportError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-loftly-danger/10 p-2 text-sm text-loftly-danger"
          data-testid="admin-waitlist-export-error"
        >
          {exportError}
        </p>
      )}

      {loadError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-loftly-danger/10 p-2 text-sm text-loftly-danger"
          data-testid="admin-waitlist-load-error"
        >
          {loadError}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-loftly-divider bg-white">
        <table
          className="w-full text-sm"
          data-testid="admin-waitlist-table"
        >
          <thead className="bg-loftly-teal-soft/40 text-left text-xs uppercase tracking-wide text-loftly-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">
                {labels.columns.createdAt}
              </th>
              <th className="px-3 py-2 font-medium">{labels.columns.email}</th>
              <th className="px-3 py-2 font-medium">{labels.columns.source}</th>
              <th className="px-3 py-2 font-medium">
                {labels.columns.variant}
              </th>
              <th className="px-3 py-2 font-medium">{labels.columns.tier}</th>
              <th className="px-3 py-2 font-medium">
                {labels.columns.monthlyPriceThb}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr data-testid="admin-waitlist-empty">
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-loftly-ink-muted"
                >
                  {labels.emptyState}
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-loftly-divider"
                  data-testid={`admin-waitlist-row-${e.id}`}
                >
                  <td className="px-3 py-2 text-xs text-loftly-ink-muted">
                    {formatCreatedAt(e.created_at)}
                  </td>
                  <td className="px-3 py-2 font-medium text-loftly-ink">
                    {e.email}
                  </td>
                  <td className="px-3 py-2 text-loftly-ink">{e.source}</td>
                  <td className="px-3 py-2 text-loftly-ink">
                    {e.variant ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-loftly-ink">{e.tier ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-loftly-ink">
                    {e.monthly_price_thb ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-md border border-loftly-divider bg-white px-3 py-1.5 text-sm font-medium text-loftly-ink hover:bg-loftly-teal-soft/40 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="admin-waitlist-load-more"
          >
            {loadingMore ? labels.loadingMore : labels.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 16).replace('T', ' ')}Z`;
  } catch {
    return iso;
  }
}

function buildCsv(rows: WaitlistEntry[]): string {
  const header = CSV_COLUMNS.join(',');
  const body = rows
    .map((row) =>
      CSV_COLUMNS.map((col) => csvCell(row[col])).join(','),
    )
    .join('\n');
  return `${header}\n${body}\n`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildFilename(source: SourceFilterValue): string {
  const today = new Date().toISOString().slice(0, 10);
  const label = source === 'all' ? 'all' : source;
  return `waitlist-${today}-${label}.csv`;
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

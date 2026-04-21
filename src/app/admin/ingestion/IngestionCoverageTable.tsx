'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { BankCoverageBadge } from '@/components/admin/BankCoverageBadge';
import {
  resyncBankIngestion,
  type BankCoverage,
  type BankCoverageStatus,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Client-side coverage table — renders the bank rows, the expand-to-view
 * control, and the manual re-sync button.
 *
 * Why a client component:
 *   - Resync is a per-row POST the founder fires interactively, so the button
 *     needs local pending / error state.
 *   - The expand-row disclosure (linking to `/admin/promos?bank=…`) is just an
 *     anchor today, but we keep it inside the client tree so we can swap it
 *     for a richer inline drawer (recent promos preview, coverage delta
 *     sparkline, …) without reshuffling the server page.
 *
 * The table is deliberately chatty with test ids — the `admin-ingestion-row-*`
 * pattern lets the page test assert individual rows without DOM traversal.
 */

export interface IngestionCoverageTableProps {
  banks: BankCoverage[];
  /**
   * Admin JWT passed down from the server component. The resync button posts
   * to `/v1/admin/ingestion/{bank_slug}/resync` directly from the browser —
   * the token travels as a Bearer header via `apiFetch`.
   */
  accessToken: string;
  labels: {
    columns: {
      bank: string;
      dealHarvester: string;
      manual: string;
      activeTotal: string;
      lastSynced: string;
      status: string;
      actions: string;
    };
    statusLabels: Record<BankCoverageStatus, string>;
    viewPromos: string;
    resyncCta: string;
    resyncRunning: string;
    resyncDone: string;
    resyncMissingEndpoint: string;
    never: string;
  };
}

type ResyncState = {
  status: 'idle' | 'running' | 'done' | 'error';
  message?: string;
};

function formatLastSynced(iso: string | null, neverLabel: string): string {
  if (!iso) return neverLabel;
  try {
    const d = new Date(iso);
    // Compact UTC stamp — the admin is timezone-agnostic and a human-readable
    // "2026-04-21 10:00Z" is easier to scan than a full locale string.
    return `${d.toISOString().slice(0, 16).replace('T', ' ')}Z`;
  } catch {
    return iso;
  }
}

export function IngestionCoverageTable({
  banks,
  accessToken,
  labels,
}: IngestionCoverageTableProps) {
  const [resync, setResync] = useState<Record<string, ResyncState>>({});
  const [, startTransition] = useTransition();

  function handleResync(bankSlug: string) {
    setResync((prev) => ({ ...prev, [bankSlug]: { status: 'running' } }));
    startTransition(async () => {
      try {
        await resyncBankIngestion(bankSlug, accessToken);
        setResync((prev) => ({ ...prev, [bankSlug]: { status: 'done' } }));
      } catch (err) {
        const message =
          err instanceof LoftlyAPIError && err.status === 404
            ? labels.resyncMissingEndpoint
            : err instanceof LoftlyAPIError
              ? err.message_en
              : 'Network error';
        setResync((prev) => ({
          ...prev,
          [bankSlug]: { status: 'error', message },
        }));
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table
        className="w-full text-sm"
        data-testid="admin-ingestion-table"
      >
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">{labels.columns.bank}</th>
            <th className="px-3 py-2 font-medium">
              {labels.columns.dealHarvester}
            </th>
            <th className="px-3 py-2 font-medium">{labels.columns.manual}</th>
            <th className="px-3 py-2 font-medium">
              {labels.columns.activeTotal}
            </th>
            <th className="px-3 py-2 font-medium">
              {labels.columns.lastSynced}
            </th>
            <th className="px-3 py-2 font-medium">{labels.columns.status}</th>
            <th className="px-3 py-2 font-medium">{labels.columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {banks.map((b) => {
            const state = resync[b.bank_slug] ?? { status: 'idle' as const };
            return (
              <tr
                key={b.bank_slug}
                className="border-t border-slate-100"
                data-testid={`admin-ingestion-row-${b.bank_slug}`}
              >
                <td className="px-3 py-2 font-medium text-slate-900">
                  {b.bank_name}
                  <div className="text-xs text-slate-500">{b.bank_slug}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {b.deal_harvester_count}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {b.manual_catalog_count}
                </td>
                <td className="px-3 py-2 tabular-nums font-semibold">
                  {b.active_promos_count}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {formatLastSynced(b.last_synced_at, labels.never)}
                </td>
                <td className="px-3 py-2">
                  <BankCoverageBadge
                    status={b.coverage_status}
                    label={labels.statusLabels[b.coverage_status]}
                    testId={`admin-ingestion-badge-${b.bank_slug}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <Link
                      href={`/admin/promos?bank=${encodeURIComponent(b.bank_slug)}`}
                      className="text-xs font-medium text-sky-700 hover:underline"
                      data-testid={`admin-ingestion-view-${b.bank_slug}`}
                    >
                      {labels.viewPromos}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleResync(b.bank_slug)}
                      disabled={state.status === 'running'}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid={`admin-ingestion-resync-${b.bank_slug}`}
                    >
                      {state.status === 'running'
                        ? labels.resyncRunning
                        : state.status === 'done'
                          ? labels.resyncDone
                          : labels.resyncCta}
                    </button>
                    {state.status === 'error' && state.message && (
                      <span
                        role="alert"
                        className="text-xs text-red-700"
                        data-testid={`admin-ingestion-resync-error-${b.bank_slug}`}
                      >
                        {state.message}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  bulkAssignMappingQueueItems,
  type BulkAssignProgress,
  type MappingQueueItem,
} from '@/lib/api/admin';
import type { Card } from '@/lib/api/types';
import { MappingQueueRow } from './MappingQueueRow';
import { useTrackEvent } from '@/lib/analytics';

/**
 * Client-side wrapper around the mapping queue table.
 *
 * Adds three pieces of admin UX on top of the per-row flow that already lived
 * in {@link MappingQueueRow}:
 *
 *   1. Row-level checkboxes + a "select all visible" header checkbox.
 *   2. A bulk-assign bar that appears when ≥1 row is selected. It binds the
 *      same set of card IDs to every selected promo. Today this loops through
 *      the per-row endpoint (see {@link bulkAssignMappingQueueItems} for the
 *      backend follow-up note); the signature is already bulk-shaped so the
 *      swap to a real `/mapping-queue/bulk-assign` endpoint is a one-line fix.
 *   3. An "Unresolved > X days" filter (7 / 14 / 30 / all) that narrows the
 *      visible rows by `last_synced_at`. Rows with a missing timestamp are
 *      surfaced in every window — we'd rather over-show than hide work.
 *
 * PostHog event `admin_mapping_bulk_assigned` fires once per bulk submit with
 * `{ count, card_id_hash }`. The card ID is hashed with SHA-256 (first 8 hex
 * chars) before send so aggregate analytics stay non-PII.
 */

export interface MappingQueueTableLabels {
  columns: {
    title: string;
    bank: string;
    cardTypes: string;
    suggested: string;
    action: string;
  };
  bulkBar: {
    selectAll: string;
    assign: string;
    assignTo: (n: number) => string;
    cancel: string;
    progress: (done: number, total: number) => string;
    cardPickerPlaceholder: string;
    cardPickerLabel: string;
  };
  filter: {
    unresolvedDays: string;
    days7: string;
    days14: string;
    days30: string;
    all: string;
  };
  emptyState: string;
  emptyFiltered: string;
}

export interface MappingQueueTableProps {
  items: MappingQueueItem[];
  cards: Array<Pick<Card, 'id' | 'display_name'> & { bank_slug?: string }>;
  accessToken: string;
  labels: MappingQueueTableLabels;
}

type UnresolvedWindow = '7' | '14' | '30' | 'all';

/**
 * Keep a visible row if its `last_synced_at` is at least `days` days old —
 * i.e. it has been unresolved for longer than the filter window. Rows without
 * a timestamp are always kept so we never silently hide work from the admin.
 */
function isOlderThanDays(
  item: MappingQueueItem,
  days: number,
  now: number,
): boolean {
  if (!item.last_synced_at) return true;
  const parsed = Date.parse(item.last_synced_at);
  if (Number.isNaN(parsed)) return true;
  const ageMs = now - parsed;
  return ageMs >= days * 24 * 60 * 60 * 1000;
}

async function hashCardId(cardId: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Non-browser fallback (tests under jsdom have crypto.subtle, but be safe).
    return cardId.slice(0, 8);
  }
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(cardId),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export function MappingQueueTable({
  items,
  cards,
  accessToken,
  labels,
}: MappingQueueTableProps) {
  const router = useRouter();
  const track = useTrackEvent();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [window, setWindow] = React.useState<UnresolvedWindow>('all');
  const [cardQuery, setCardQuery] = React.useState('');
  const [cardId, setCardId] = React.useState<string>('');
  const [progress, setProgress] = React.useState<BulkAssignProgress | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const now = React.useMemo(() => Date.now(), []);

  const visible = React.useMemo(() => {
    if (window === 'all') return items;
    const days = Number.parseInt(window, 10);
    return items.filter((it) => isOlderThanDays(it, days, now));
  }, [items, window, now]);

  // If the filter hid a selected row, drop it from the selection so the
  // bulk-assign count stays honest.
  React.useEffect(() => {
    setSelected((prev) => {
      const visibleIds = new Set(visible.map((v) => v.promo_id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visible]);

  const allVisibleChecked =
    visible.length > 0 && visible.every((v) => selected.has(v.promo_id));
  const someVisibleChecked =
    !allVisibleChecked && visible.some((v) => selected.has(v.promo_id));

  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleChecked;
    }
  }, [someVisibleChecked]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleChecked) {
        // Clear only the visible rows — preserve any previously-selected rows
        // that are currently filtered out (edge case; the useEffect above
        // usually prunes them but keep the logic defensive).
        const next = new Set(prev);
        for (const v of visible) next.delete(v.promo_id);
        return next;
      }
      const next = new Set(prev);
      for (const v of visible) next.add(v.promo_id);
      return next;
    });
  }

  function cancelBulk() {
    setSelected(new Set());
    setCardId('');
    setCardQuery('');
    setProgress(null);
    setError(null);
  }

  async function handleBulkAssign() {
    if (!cardId || selected.size === 0) return;
    setIsSubmitting(true);
    setError(null);
    setProgress({ completed: 0, total: selected.size, failed: [] });

    const promoIds = Array.from(selected);
    try {
      const result = await bulkAssignMappingQueueItems(
        promoIds,
        [cardId],
        accessToken,
        {
          onProgress: (p) => setProgress(p),
        },
      );
      const cardIdHash = await hashCardId(cardId);
      track('admin_mapping_bulk_assigned', {
        count: result.completed - result.failed.length,
        card_id_hash: cardIdHash,
      });
      if (result.failed.length > 0) {
        setError(
          `${result.failed.length} of ${result.total} failed: ${result.failed
            .slice(0, 3)
            .map((f) => f.message)
            .join('; ')}`,
        );
      } else {
        cancelBulk();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk assign failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredCards = React.useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q) return cards.slice(0, 50);
    return cards
      .filter((c) => {
        const hay = `${c.display_name} ${c.bank_slug ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [cards, cardQuery]);

  return (
    <div className="space-y-4" data-testid="mapping-queue-table">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="mapping-queue-days-filter"
          className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted"
        >
          {labels.filter.unresolvedDays}
        </label>
        <select
          id="mapping-queue-days-filter"
          data-testid="mapping-queue-days-filter"
          value={window}
          onChange={(e) => setWindow(e.target.value as UnresolvedWindow)}
          className="rounded-md border border-loftly-divider bg-white px-2 py-1 text-sm"
        >
          <option value="7">{labels.filter.days7}</option>
          <option value="14">{labels.filter.days14}</option>
          <option value="30">{labels.filter.days30}</option>
          <option value="all">{labels.filter.all}</option>
        </select>
        <p className="text-xs text-loftly-ink-muted" data-testid="mapping-queue-count">
          {visible.length} / {items.length}
        </p>
      </div>

      {selected.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border border-loftly-teal/40 bg-loftly-teal/5 p-3"
          data-testid="mapping-queue-bulk-bar"
          role="region"
          aria-label={labels.bulkBar.assignTo(selected.size)}
        >
          <span className="text-sm font-medium text-loftly-ink">
            {labels.bulkBar.assignTo(selected.size)}
          </span>

          <label className="sr-only" htmlFor="mapping-queue-card-picker">
            {labels.bulkBar.cardPickerLabel}
          </label>
          <input
            id="mapping-queue-card-picker"
            data-testid="mapping-queue-card-picker"
            list="mapping-queue-card-options"
            value={cardQuery}
            onChange={(e) => {
              setCardQuery(e.target.value);
              // When the typed value matches an option exactly, lock the ID in.
              const match = cards.find(
                (c) => c.display_name === e.target.value,
              );
              setCardId(match ? match.id : '');
            }}
            placeholder={labels.bulkBar.cardPickerPlaceholder}
            className="min-w-[240px] rounded-md border border-loftly-divider bg-white px-2 py-1 text-sm"
          />
          <datalist id="mapping-queue-card-options">
            {filteredCards.map((c) => (
              <option key={c.id} value={c.display_name}>
                {c.bank_slug ? `${c.bank_slug} · ${c.id.slice(0, 8)}` : c.id}
              </option>
            ))}
          </datalist>

          <button
            type="button"
            onClick={handleBulkAssign}
            disabled={!cardId || isSubmitting}
            data-testid="mapping-queue-bulk-assign"
            className="rounded-md bg-loftly-teal px-3 py-1.5 text-xs font-medium text-white hover:bg-loftly-teal/90 disabled:opacity-50"
          >
            {labels.bulkBar.assign}
          </button>

          <button
            type="button"
            onClick={cancelBulk}
            disabled={isSubmitting}
            className="rounded-md border border-loftly-divider bg-white px-3 py-1.5 text-xs font-medium text-loftly-ink hover:bg-loftly-teal-soft/40 disabled:opacity-50"
          >
            {labels.bulkBar.cancel}
          </button>

          {progress && isSubmitting && (
            <span
              className="text-xs text-loftly-ink-muted"
              data-testid="mapping-queue-bulk-progress"
              role="status"
              aria-live="polite"
            >
              {labels.bulkBar.progress(progress.completed, progress.total)}
            </span>
          )}
          {error && (
            <span
              className="text-xs text-loftly-danger"
              data-testid="mapping-queue-bulk-error"
              role="alert"
            >
              {error}
            </span>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-loftly-divider p-6 text-sm text-loftly-ink-muted">
          {items.length === 0 ? labels.emptyState : labels.emptyFiltered}
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-loftly-divider bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-loftly-teal-soft/40 text-left text-xs uppercase tracking-wide text-loftly-ink-muted">
              <tr>
                <th className="w-10 px-4 py-2">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    aria-label={labels.bulkBar.selectAll}
                    data-testid="mapping-queue-select-all"
                    checked={allVisibleChecked}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="px-4 py-2">{labels.columns.title}</th>
                <th className="px-4 py-2">{labels.columns.bank}</th>
                <th className="px-4 py-2">{labels.columns.cardTypes}</th>
                <th className="px-4 py-2">{labels.columns.suggested}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((it) => (
                <MappingQueueRow
                  key={it.promo_id}
                  item={it}
                  accessToken={accessToken}
                  checked={selected.has(it.promo_id)}
                  onToggle={() => toggleRow(it.promo_id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

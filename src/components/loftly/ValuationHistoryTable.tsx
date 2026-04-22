import { cn } from '@/lib/utils';

/**
 * ValuationHistoryTable — renders last N weekly valuations for a currency.
 *
 * Values come from `ValuationDetail.history[]` (computed_at + thb_per_point).
 * We sort newest-first and cap at 4 rows by default. Empty history renders a
 * dash placeholder without throwing.
 */

export interface ValuationHistoryPoint {
  thb_per_point: number;
  computed_at: string;
}

export interface ValuationHistoryTableProps {
  history?: ValuationHistoryPoint[] | null;
  locale?: 'th' | 'en';
  limit?: number;
  headers?: { date: string; value: string };
  emptyText?: string;
  className?: string;
}

function formatDate(iso: string, locale: 'th' | 'en'): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ValuationHistoryTable({
  history,
  locale = 'th',
  limit = 4,
  headers = { date: 'Week of', value: 'THB / point' },
  emptyText = '—',
  className,
}: ValuationHistoryTableProps) {
  const rows = (history ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime(),
    )
    .slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className={cn('text-sm text-loftly-ink-muted', className)}>{emptyText}</p>
    );
  }

  return (
    <table
      className={cn(
        'w-full border-collapse text-left text-sm',
        className,
      )}
      data-testid="valuation-history-table"
    >
      <thead>
        <tr className="border-b border-loftly-divider text-xs uppercase tracking-wide text-loftly-ink-muted">
          <th className="py-2 pr-4 font-medium">{headers.date}</th>
          <th className="py-2 font-medium">{headers.value}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={`${row.computed_at}-${i}`}
            className="border-b border-loftly-divider last:border-b-0"
          >
            <td className="py-2 pr-4 text-loftly-ink">
              {formatDate(row.computed_at, locale)}
            </td>
            <td className="py-2 font-medium tabular-nums text-loftly-ink">
              {row.thb_per_point.toFixed(4)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

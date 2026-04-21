import Link from 'next/link';
import { ValuationBadge } from '@/components/loftly/ValuationBadge';
import type { Valuation } from '@/lib/api/types';

/**
 * LatestValuationsList — 5 most-recently-updated valuations for the
 * landing "มูลค่าแต้มล่าสุด" section. Each row links to
 * `/valuations/[code]` for the currency detail page.
 *
 * The row reuses `ValuationBadge` for the display logic (confidence
 * banding, airline vs point label). Currency names render in Thai per
 * BRAND.md §4.
 */

export interface LatestValuationsListProps {
  valuations: Valuation[];
  emptyLabel: string;
  browseAllLabel: string;
}

export function LatestValuationsList({
  valuations,
  emptyLabel,
  browseAllLabel,
}: LatestValuationsListProps) {
  if (valuations.length === 0) {
    return (
      <div
        data-testid="latest-valuations-empty"
        className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600"
      >
        <p>{emptyLabel}</p>
        <Link
          href="/cards"
          className="mt-2 inline-block font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {browseAllLabel} →
        </Link>
      </div>
    );
  }

  return (
    <ul
      data-testid="latest-valuations-list"
      className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white"
    >
      {valuations.map((v) => (
        <li key={v.currency.code}>
          <Link
            href={`/valuations/${encodeURIComponent(v.currency.code)}`}
            data-testid="latest-valuations-item"
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-slate-50"
          >
            <span className="font-medium text-slate-900">
              {v.currency.display_name_th}
              <span className="ml-1 text-xs tracking-wide text-slate-500">
                {v.currency.code}
              </span>
            </span>
            <ValuationBadge currency={v.currency} valuation={v} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

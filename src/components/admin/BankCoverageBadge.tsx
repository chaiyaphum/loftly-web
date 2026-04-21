import type { BankCoverageStatus } from '@/lib/api/admin';

/**
 * Small coloured pill that summarises a bank's ingestion coverage — rendered
 * in the `/admin/ingestion` table's rightmost column.
 *
 * Colour language:
 *   - `full`    → emerald (everything current)
 *   - `partial` → amber   (one source lagging — usually manual catalog stale)
 *   - `gap`     → red     (neither source fresh — needs founder attention)
 *
 * The badge is purely presentational. Callers pass the label they want
 * displayed so the component doesn't need to own the i18n key resolution.
 */
export interface BankCoverageBadgeProps {
  status: BankCoverageStatus;
  label: string;
  testId?: string;
}

const STYLES: Record<BankCoverageStatus, string> = {
  full: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-800 border-amber-200',
  gap: 'bg-red-50 text-red-700 border-red-200',
};

export function BankCoverageBadge({
  status,
  label,
  testId,
}: BankCoverageBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
      data-testid={testId}
      data-status={status}
    >
      {label}
    </span>
  );
}

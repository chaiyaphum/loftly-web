import { cn } from '@/lib/utils';

/**
 * ValuationBadge — STUB.
 *
 * Per UI_WEB.md §Component inventory, renders an inline THB-per-point badge
 * with a confidence band. When confidence < 0.6, prefixes the THB value with
 * "~" (see UI_CONTENT.md §Honest-uncertainty phrases).
 *
 * Currency is displayed verbatim (e.g., "ROP", "KrisFlyer", "K Point") —
 * never translated per BRAND.md §4 "Brand names: keep original".
 */
export interface ValuationBadgeProps {
  /** Loyalty currency code, e.g., "ROP", "KRISFLYER", "K_POINT" */
  currency: string;
  /** THB value per 1 unit (1 mile or 1 point) */
  value: number;
  /** 0..1 — below 0.6 triggers the "~" prefix */
  confidence: number;
  className?: string;
}

export function ValuationBadge({ currency, value, confidence, className }: ValuationBadgeProps) {
  const lowConfidence = confidence < 0.6;
  const formatted = value.toFixed(2);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium',
        lowConfidence && 'bg-amber-50 text-amber-900',
        className,
      )}
      aria-label={`1 ${currency} equals ${lowConfidence ? 'approximately ' : ''}${formatted} THB`}
    >
      1 {currency} = {lowConfidence ? '~' : ''}
      {formatted} THB
    </span>
  );
}

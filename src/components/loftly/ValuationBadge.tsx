import type { Currency, Valuation } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * ValuationBadge — inline THB-per-point readout.
 *
 * Template per Q8 (UI_CONTENT.md §Valuation sentence template):
 *   - airline currencies (`currency_type: airline`) → "1 {CODE} mile = {value} THB"
 *   - bank / hotel currencies → "1 {CODE} point = {value} THB"
 *
 * Confidence banding per VALUATION_METHOD.md:
 *   - `confidence >= 0.6` → exact value (e.g., "1.52 THB")
 *   - `0.4 <= confidence < 0.6` → `~1.52 THB` (directional prefix)
 *   - `confidence < 0.4` → range-only `~{lo}–{hi} THB` using distribution band
 *     (±40% around the central value as the conservative display band)
 *
 * Currency code is rendered verbatim — never translated (BRAND.md §4
 * "Brand names: keep original").
 */

export interface ValuationBadgeProps {
  currency: Currency;
  valuation: Valuation;
  className?: string;
}

type Band = 'exact' | 'directional' | 'range';

function bandFor(confidence: number): Band {
  if (confidence >= 0.6) return 'exact';
  if (confidence >= 0.4) return 'directional';
  return 'range';
}

function unitFor(currency: Currency): 'mile' | 'point' {
  return currency.currency_type === 'airline' ? 'mile' : 'point';
}

function formatTHB(value: number): string {
  // 2 decimals — valuations are typically sub-baht precision.
  return value.toFixed(2);
}

export function ValuationBadge({
  currency,
  valuation,
  className,
}: ValuationBadgeProps) {
  const band = bandFor(valuation.confidence);
  const unit = unitFor(currency);
  const value = valuation.thb_per_point;

  let display: string;
  if (band === 'range') {
    const lo = formatTHB(value * 0.6);
    const hi = formatTHB(value * 1.4);
    display = `~${lo}–${hi} THB`;
  } else if (band === 'directional') {
    display = `~${formatTHB(value)} THB`;
  } else {
    display = `${formatTHB(value)} THB`;
  }

  const label = `1 ${currency.code} ${unit} = ${display}`;
  const isLowConfidence = band !== 'exact';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium font-mono',
        isLowConfidence
          ? 'bg-loftly-amber/15 text-loftly-amber-urgent'
          : 'bg-loftly-teal-soft text-loftly-teal',
        className,
      )}
      title={valuation.methodology}
      aria-label={label}
      data-confidence-band={band}
    >
      {label}
    </span>
  );
}

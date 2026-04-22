import { cn } from '@/lib/utils';

/**
 * ConfidenceBar — horizontal stacked-bar for a 0..1 confidence score.
 *
 * Visualizes the confidence band per VALUATION_METHOD.md §Confidence score:
 *   ≥ 0.8  full · emerald
 *   0.6–0.79 full + tooltip · sky
 *   0.4–0.59 directional · amber
 *   < 0.4  range-only · slate
 *
 * The fill width is clamped to [0, 100] and rendered as a percent.
 */

export type ConfidenceBand = 'full' | 'tooltip' | 'directional' | 'range';

export function bandForConfidence(value: number): ConfidenceBand {
  if (value >= 0.8) return 'full';
  if (value >= 0.6) return 'tooltip';
  if (value >= 0.4) return 'directional';
  return 'range';
}

export interface ConfidenceBarProps {
  /** 0..1 */
  value: number;
  /** 0..1 — value below this is flagged as under-sampled. Default 0.4. */
  threshold?: number;
  className?: string;
  label?: string;
}

export function ConfidenceBar({
  value,
  threshold = 0.4,
  className,
  label,
}: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const pct = Math.round(clamped * 100);
  const band = bandForConfidence(clamped);

  const fillClass: Record<ConfidenceBand, string> = {
    full: 'bg-loftly-teal-soft0',
    tooltip: 'bg-sky-500',
    directional: 'bg-loftly-amber/150',
    range: 'bg-slate-400',
  };

  return (
    <div
      className={cn('flex flex-col gap-1', className)}
      data-confidence-band={band}
      data-confidence-pct={pct}
      data-under-sampled={clamped < threshold ? 'true' : 'false'}
      aria-label={label}
    >
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
        className="relative h-2 w-full overflow-hidden rounded-full bg-loftly-divider/50"
      >
        <div
          className={cn('h-full rounded-full transition-all', fillClass[band])}
          style={{ width: `${pct}%` }}
          data-testid="confidence-bar-fill"
        />
      </div>
      <span className="text-xs tabular-nums text-loftly-ink-muted">
        {pct}%
      </span>
    </div>
  );
}

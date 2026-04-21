import { cn } from '@/lib/utils';

/**
 * DistributionHistogram — inline SVG distribution rendered from percentile
 * markers (p10 / p25 / p50 / p75 / p90).
 *
 * Pure CSS/SVG, no chart library. The bar heights are derived from the
 * relative ratio of each percentile's ratio over the series max; if the
 * provided values aren't monotonically non-decreasing we still render them
 * (the distribution_summary lives upstream and is validated by the API).
 *
 * VALUATION_METHOD.md §Public methodology page calls this out explicitly as
 * part of the transparency moat.
 */

export const HISTOGRAM_PERCENTILES = ['p10', 'p25', 'p50', 'p75', 'p90'] as const;
export type HistogramKey = (typeof HISTOGRAM_PERCENTILES)[number];

export interface DistributionHistogramProps {
  /** Keyed by p10/p25/p50/p75/p90 — thb_per_point values for each tier. */
  distribution: Partial<Record<string, number>> | null | undefined;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
  /** Render each bar value above the bar (default off — kept compact). */
  showValues?: boolean;
}

export function DistributionHistogram({
  distribution,
  width = 200,
  height = 80,
  className,
  label,
  showValues = false,
}: DistributionHistogramProps) {
  const entries = HISTOGRAM_PERCENTILES.map((key) => ({
    key,
    value:
      distribution && typeof distribution[key] === 'number'
        ? (distribution[key] as number)
        : 0,
  }));

  const max = Math.max(...entries.map((e) => e.value), 0);
  const barCount = entries.length;
  const gap = 6;
  const barWidth = Math.max(4, (width - gap * (barCount + 1)) / barCount);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label ?? 'Distribution histogram'}
      data-testid="distribution-histogram"
      className={cn('block', className)}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
      />
      {entries.map((entry, i) => {
        const barHeight =
          max > 0 ? Math.max(2, (entry.value / max) * (height - 16)) : 2;
        const x = gap + i * (barWidth + gap);
        const y = height - barHeight - 2;
        return (
          <g key={entry.key} data-percentile={entry.key}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              className="fill-sky-500"
              data-testid={`histogram-bar-${entry.key}`}
            />
            <text
              x={x + barWidth / 2}
              y={height}
              textAnchor="middle"
              className="fill-slate-500 text-[8px]"
            >
              {entry.key}
            </text>
            {showValues && entry.value > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 2}
                textAnchor="middle"
                className="fill-slate-700 text-[8px]"
              >
                {entry.value.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

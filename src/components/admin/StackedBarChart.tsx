/**
 * Thin stacked-bar chart for the admin analytics dashboard.
 *
 * - Rendered as inline SVG to avoid pulling in recharts / d3 (size budget
 *   matters — see `.size-limit.json`).
 * - One bar per input `bars` entry; each bar is split into ordered `segments`
 *   stacked from the bottom up. Colours are supplied by the caller via a
 *   `segmentClassName` lookup so this file stays theme-agnostic.
 * - Bar heights are scaled relative to the tallest bar in the dataset.
 *
 * Intended use: 6-month affiliate commission (pending / confirmed / paid) for
 * the W23 dashboard, but the shape is generic.
 */
export interface StackedBarSegmentKey {
  key: string;
  label: string;
  colorClassName: string;
}

export interface StackedBar {
  label: string;
  segments: Record<string, number>;
}

export interface StackedBarChartProps {
  bars: StackedBar[];
  segmentKeys: StackedBarSegmentKey[];
  /** Width in px — defaults to 360 so two columns fit comfortably. */
  width?: number;
  /** Chart area height in px (excludes the x-axis label row). */
  height?: number;
  /** Accessible label. */
  ariaLabel?: string;
  testId?: string;
  /** Optional formatter for the tooltip `<title>` on each bar. */
  formatTotal?: (total: number) => string;
}

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 140;
const AXIS_LABEL_HEIGHT = 20;
const BAR_GAP_RATIO = 0.25;

export function StackedBarChart({
  bars,
  segmentKeys,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  ariaLabel = 'Stacked bar chart',
  testId,
  formatTotal = (n) => n.toString(),
}: StackedBarChartProps) {
  const totalHeight = height + AXIS_LABEL_HEIGHT;

  const barTotals = bars.map((b) =>
    segmentKeys.reduce((sum, sk) => sum + (b.segments[sk.key] ?? 0), 0),
  );
  const maxTotal = barTotals.reduce((m, v) => (v > m ? v : m), 0);

  const barCount = Math.max(1, bars.length);
  const barSlot = width / barCount;
  const barWidth = barSlot * (1 - BAR_GAP_RATIO);
  const barInset = (barSlot - barWidth) / 2;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={totalHeight}
      viewBox={`0 0 ${width} ${totalHeight}`}
      data-testid={testId}
    >
      {bars.map((bar, i) => {
        const total = barTotals[i] ?? 0;
        const barHeight = maxTotal === 0 ? 0 : (total / maxTotal) * height;
        const x = i * barSlot + barInset;
        let cursorY = height;

        return (
          <g key={bar.label} data-testid={testId ? `${testId}-bar` : undefined}>
            <title>
              {bar.label}: {formatTotal(total)}
            </title>
            {segmentKeys.map((sk) => {
              const value = bar.segments[sk.key] ?? 0;
              if (total === 0 || value <= 0) return null;
              const segH = (value / total) * barHeight;
              cursorY -= segH;
              return (
                <rect
                  key={sk.key}
                  x={x}
                  y={cursorY}
                  width={barWidth}
                  height={segH}
                  className={sk.colorClassName}
                  data-testid={
                    testId ? `${testId}-segment-${sk.key}` : undefined
                  }
                />
              );
            })}
            <text
              x={x + barWidth / 2}
              y={height + 14}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

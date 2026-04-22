/**
 * 12-point retention sparkline — inline SVG, no chart dep.
 *
 * Input is a plain `number[]` of retention percentages (0–1 or 0–100; we
 * auto-detect by checking the max value). Values are normalised into the SVG
 * viewBox so the line always fills the panel vertically.
 *
 * Missing / non-finite entries are treated as 0. An empty array renders a
 * single flat baseline — callers should guard with their own empty state if
 * that's semantically wrong.
 */
export interface RetentionSparklineProps {
  points: number[];
  width?: number;
  height?: number;
  /** Accessible label; defaults to an English string. */
  ariaLabel?: string;
  testId?: string;
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 40;
const PADDING = 2;

export function RetentionSparkline({
  points,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  ariaLabel = '12-week retention sparkline',
  testId,
}: RetentionSparklineProps) {
  const clean = points.map((p) => (Number.isFinite(p) ? p : 0));
  const max = clean.reduce((m, v) => (v > m ? v : m), 0);
  // If the biggest value is > 1 we assume 0–100 scale; otherwise 0–1.
  const scale = max > 1 ? 100 : 1;

  const innerW = width - PADDING * 2;
  const innerH = height - PADDING * 2;

  const coords = clean.map((v, i) => {
    const x = clean.length <= 1 ? innerW / 2 : (i / (clean.length - 1)) * innerW;
    const y = innerH - (Math.max(0, Math.min(v, scale)) / scale) * innerH;
    return { x: x + PADDING, y: y + PADDING };
  });

  const pathD =
    coords.length === 0
      ? `M ${PADDING} ${height / 2} L ${width - PADDING} ${height / 2}`
      : coords
          .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
          .join(' ');

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-loftly-teal"
      data-testid={testId}
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={1.75}
          fill="currentColor"
          data-testid={testId ? `${testId}-point` : undefined}
        />
      ))}
    </svg>
  );
}

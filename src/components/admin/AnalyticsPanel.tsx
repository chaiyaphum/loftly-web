import type { ReactNode } from 'react';

/**
 * Generic admin KPI card used by the analytics dashboard.
 *
 * - `value` is rendered as the hero number — formatting is the caller's job,
 *   so the panel stays agnostic to THB / %, integer / float, etc.
 * - `delta` is an optional period-over-period percent change; positive values
 *   render green, negatives red, zero / null suppresses the pill entirely.
 *   The direction arrow is read-aloud-friendly (aria-hidden on glyph, full
 *   text in sr-only span).
 * - `footer` is a slot for secondary metrics (latency, rate, etc.) so each
 *   dashboard section can pack 3-4 numbers without a bespoke component per
 *   panel.
 */
export interface AnalyticsPanelProps {
  title: string;
  value: string;
  /** Optional percent delta vs previous period; e.g. +12.5 or -3.0. */
  delta?: number | null;
  /** Shown below the hero number — metric rows or small charts. */
  footer?: ReactNode;
  /** Stable id for the `<section>` — referenced from tests and a11y labels. */
  testId?: string;
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

export function AnalyticsPanel({
  title,
  value,
  delta,
  footer,
  testId,
}: AnalyticsPanelProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta) && delta !== 0;
  const deltaColor =
    hasDelta && (delta as number) > 0
      ? 'bg-loftly-teal-soft text-loftly-teal'
      : 'bg-loftly-danger/10 text-loftly-danger';
  const deltaArrow = hasDelta && (delta as number) > 0 ? '▲' : '▼';
  const deltaAria =
    hasDelta && (delta as number) > 0 ? 'Up from previous period' : 'Down from previous period';

  return (
    <section
      className="flex flex-col gap-3 rounded-md border border-loftly-divider bg-white p-5"
      data-testid={testId}
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
          {title}
        </h2>
        {hasDelta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${deltaColor}`}
            data-testid={testId ? `${testId}-delta` : undefined}
          >
            <span aria-hidden="true">{deltaArrow}</span>
            <span className="sr-only">{deltaAria}</span>
            {formatDelta(delta as number)}
          </span>
        )}
      </header>
      <p
        className="text-3xl font-semibold text-loftly-ink"
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </p>
      {footer ? <div className="text-sm text-loftly-ink-muted">{footer}</div> : null}
    </section>
  );
}

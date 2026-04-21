import { cn } from '@/lib/utils';

/**
 * THB display helper.
 *
 * - `full` (default): `THB 80,000` via `Intl.NumberFormat('th-TH')`
 * - `compact`: `80k`, `2m` (ascii, not Thai numerals) — used in dense UI
 *   surfaces like the selector results secondary tiers.
 *
 * Per UI_WEB.md §i18n spec: we prefix `THB`, never use `฿` glyph.
 */

export interface ThaiNumberFormatProps {
  value: number;
  variant?: 'full' | 'compact';
  /** When `true`, only render the number (no THB prefix). Defaults to false. */
  hidePrefix?: boolean;
  className?: string;
}

const fullFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 0,
});

export function formatTHBFull(value: number, hidePrefix = false): string {
  const formatted = fullFormatter.format(Math.round(value));
  return hidePrefix ? formatted : `THB ${formatted}`;
}

export function formatTHBCompact(value: number, hidePrefix = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  let body: string;
  if (abs >= 1_000_000) {
    body = `${trimZero(abs / 1_000_000)}m`;
  } else if (abs >= 1_000) {
    body = `${trimZero(abs / 1_000)}k`;
  } else {
    body = String(Math.round(abs));
  }
  const out = `${sign}${body}`;
  return hidePrefix ? out : `THB ${out}`;
}

function trimZero(n: number): string {
  // Keep one decimal unless it's exactly an integer. `80k` not `80.0k`,
  // but `2.5m` not `2m`.
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

export function ThaiNumberFormat({
  value,
  variant = 'full',
  hidePrefix,
  className,
}: ThaiNumberFormatProps) {
  const str =
    variant === 'compact'
      ? formatTHBCompact(value, hidePrefix)
      : formatTHBFull(value, hidePrefix);
  return (
    <span className={cn('tabular-nums', className)}>{str}</span>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * CountdownTimer — day/hour precision countdown to a target ISO timestamp.
 *
 * Used by `/account/delete` (14-day grace period) and `/account/data-export`
 * (download-URL expiry). The component is deliberately minimal — it ticks
 * once per second on the client and formats the remaining delta as a Thai
 * or English string passed in via `labels`.
 *
 * When the deadline has passed we render `labels.expired` and stop ticking.
 */

export interface CountdownLabels {
  day: string;
  hour: string;
  minute: string;
  second: string;
  expired: string;
}

export interface CountdownTimerProps {
  /** Target ISO timestamp (server-provided). */
  targetIso: string;
  labels?: Partial<CountdownLabels>;
  /** If false, show only days + hours (useful for multi-day deadlines). */
  showSeconds?: boolean;
  className?: string;
  /** Test hook — override the clock. */
  now?: () => number;
}

const DEFAULT_LABELS: CountdownLabels = {
  day: 'd',
  hour: 'h',
  minute: 'm',
  second: 's',
  expired: 'expired',
};

function computeRemaining(targetMs: number, now: number) {
  const delta = Math.max(0, targetMs - now);
  const totalSeconds = Math.floor(delta / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { delta, days, hours, minutes, seconds };
}

export function CountdownTimer({
  targetIso,
  labels,
  showSeconds = false,
  className,
  now: nowFn,
}: CountdownTimerProps) {
  const effectiveLabels = { ...DEFAULT_LABELS, ...labels };
  const targetMs = Date.parse(targetIso);
  const getNow = nowFn ?? (() => Date.now());

  const [now, setNow] = useState<number>(() => getNow());

  useEffect(() => {
    if (!Number.isFinite(targetMs)) return;
    const id = setInterval(() => setNow(getNow()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs]);

  if (!Number.isFinite(targetMs)) {
    return (
      <span
        className={cn('text-sm text-slate-500', className)}
        data-testid="countdown-invalid"
      >
        —
      </span>
    );
  }

  const remaining = computeRemaining(targetMs, now);
  if (remaining.delta <= 0) {
    return (
      <span
        className={cn('text-sm text-slate-500', className)}
        data-testid="countdown-expired"
      >
        {effectiveLabels.expired}
      </span>
    );
  }

  const parts = [
    `${remaining.days}${effectiveLabels.day}`,
    `${remaining.hours}${effectiveLabels.hour}`,
    `${remaining.minutes}${effectiveLabels.minute}`,
  ];
  if (showSeconds) parts.push(`${remaining.seconds}${effectiveLabels.second}`);

  return (
    <span
      className={cn('tabular-nums', className)}
      data-testid="countdown-remaining"
      data-countdown-seconds={Math.floor(remaining.delta / 1000)}
    >
      {parts.join(' ')}
    </span>
  );
}

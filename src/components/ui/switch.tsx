'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Minimal accessible switch — simplified from the Radix version to avoid
 * pulling another dependency when our needs are limited. If we later need
 * full form integration we'll swap in `@radix-ui/react-switch`.
 */

export interface SwitchProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

export function Switch({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
  ...ariaProps
}: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loftly-sky',
        checked ? 'bg-loftly-baht' : 'bg-slate-300',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      {...ariaProps}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

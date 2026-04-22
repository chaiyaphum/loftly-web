'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

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
        checked ? 'bg-loftly-teal' : 'bg-loftly-divider',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      {...ariaProps}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-loftly-surface shadow ring-0 transition',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

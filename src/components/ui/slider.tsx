'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Minimal accessible single-thumb slider.
 *
 * Backed by the native `<input type="range">` so:
 *   - Keyboard navigation (arrow keys, PgUp/PgDn, Home/End) works for free
 *   - Screen readers get WAI-ARIA semantics without extra wiring
 *   - `prefers-reduced-motion` is honored by the browser
 *
 * We intentionally skip `@radix-ui/react-slider` to avoid another dependency
 * when our only consumer is `SpendCategorySliders`. Swap it in later if we
 * need multi-thumb / dual-handle ranges.
 */

export interface SliderProps {
  id?: string;
  value: number;
  onValueChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-valuetext'?: string;
  className?: string;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  function Slider(
    {
      id,
      value,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled,
      className,
      ...ariaProps
    },
    ref,
  ) {
    return (
      <input
        id={id}
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-loftly-baht',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loftly-sky',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...ariaProps}
      />
    );
  },
);

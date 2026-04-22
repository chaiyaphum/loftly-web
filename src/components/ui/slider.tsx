'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

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
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-loftly-divider accent-loftly-teal',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...ariaProps}
      />
    );
  },
);

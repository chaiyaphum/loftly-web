import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'outline' | 'warn' | 'success';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-900',
  outline: 'border border-slate-300 bg-transparent text-slate-700',
  warn: 'bg-amber-50 text-amber-900',
  success: 'bg-emerald-50 text-emerald-900',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = 'default',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

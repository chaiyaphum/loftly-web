import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'outline'
  | 'warn'
  | 'success'
  | 'teal'
  | 'amber'
  | 'danger';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-loftly-divider/60 text-loftly-ink',
  outline: 'border border-loftly-divider bg-transparent text-loftly-ink-muted',
  teal: 'bg-loftly-teal-soft text-loftly-teal',
  amber: 'bg-loftly-amber/10 text-loftly-amber-urgent',
  success: 'bg-loftly-teal-soft text-loftly-success',
  warn: 'bg-loftly-amber/15 text-loftly-amber-urgent',
  danger: 'bg-loftly-danger/10 text-loftly-danger',
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
        'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

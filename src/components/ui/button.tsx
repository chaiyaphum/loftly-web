import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

/**
 * Minimal shadcn-style Button — proves the shadcn/ui pattern works in this repo.
 * Additional variants (outline, ghost, destructive) are added as needed; we
 * deliberately do NOT run `shadcn add` for every primitive up front.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

const baseStyles =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loftly-sky disabled:pointer-events-none disabled:opacity-50';

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-loftly-baht text-white hover:bg-loftly-baht/90',
  outline: 'border border-slate-300 bg-transparent text-loftly-ink hover:bg-slate-50',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, asChild = false, variant = 'default', size = 'default', ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    />
  );
});

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

/**
 * Button primitive — brief §7 variants.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'danger' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const baseStyles =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-loftly-teal text-white hover:bg-loftly-teal-hover shadow-subtle',
  secondary:
    'bg-loftly-teal-soft text-loftly-teal hover:bg-loftly-teal-soft/80',
  outline:
    'border border-loftly-divider bg-loftly-surface text-loftly-ink hover:bg-loftly-teal-soft hover:border-loftly-teal hover:text-loftly-teal',
  ghost:
    'bg-transparent text-loftly-ink hover:bg-loftly-teal-soft hover:text-loftly-teal',
  danger:
    'bg-loftly-danger text-white hover:bg-loftly-danger/90',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-10 px-4 text-sm',
  // sm kept at 36px — tall enough for a usable mobile touch target without
  // crowding the default/lg slots visually (WCAG AAA recommends 44px; 36px
  // meets AA and keeps visual hierarchy with `default` 40 / `lg` 48).
  sm: 'h-9 px-3 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
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

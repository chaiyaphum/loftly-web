import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable card for the `/account` settings landing page.
 *
 * Renders an icon, title, 1-line description and a CTA linking to the
 * matching sub-route (e.g. `/account/consent`, `/account/data-export`,
 * `/account/delete`). The card itself is a single focusable surface —
 * the whole tile is wrapped in a `<Link>` so keyboard + screen-reader
 * users don't have to tab through three times.
 */

export interface AccountCardProps {
  href: string;
  title: string;
  description: string;
  cta: string;
  /** Optional leading icon / glyph. Decorative only — `aria-hidden`. */
  icon?: ReactNode;
  /** Stable id for tests / analytics wiring. */
  testId?: string;
  /** Tone: default stays neutral; `danger` highlights destructive flows. */
  tone?: 'default' | 'danger';
}

export function AccountCard({
  href,
  title,
  description,
  cta,
  icon,
  testId,
  tone = 'default',
}: AccountCardProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        'group flex h-full flex-col gap-3 rounded-lg border p-5 shadow-sm transition-colors',
        'hover:border-slate-300 hover:bg-slate-50',
        tone === 'danger'
          ? 'border-red-200 bg-white'
          : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg',
              tone === 'danger'
                ? 'bg-red-50 text-red-700'
                : 'bg-slate-100 text-slate-700',
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <span
        className={cn(
          'mt-auto inline-flex items-center gap-1 text-sm font-medium',
          tone === 'danger'
            ? 'text-red-700 group-hover:text-red-800'
            : 'text-loftly-baht group-hover:text-loftly-baht/80',
        )}
        data-testid={testId ? `${testId}-cta` : undefined}
      >
        {cta}
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

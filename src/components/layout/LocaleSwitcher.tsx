'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * TH / EN toggle — swaps locale in-place on the current pathname.
 * Uses next-intl's typed router so the locale prefix is set correctly.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: (typeof routing.locales)[number]) => {
    if (next === locale || isPending) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-loftly-divider bg-loftly-surface p-0.5 text-caption',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            aria-pressed={active}
            disabled={isPending}
            className={cn(
              'inline-flex h-6 min-w-[28px] items-center justify-center rounded-full px-2 font-medium uppercase tracking-wide transition-colors',
              active
                ? 'bg-loftly-teal text-white'
                : 'text-loftly-ink-muted hover:text-loftly-ink',
            )}
          >
            {loc}
          </button>
        );
      })}
    </div>
  );
}

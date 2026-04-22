'use client';

import { useTranslations } from 'next-intl';
import { BarChart3, Flame, Search, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: RegExp;
};

/**
 * Mobile bottom nav — brief §15.4: 4 tabs, fixed to bottom, 56px tall,
 * iOS safe-area aware. Hidden at md+ where the header nav takes over.
 */
export function MobileBottomNav() {
  const t = useTranslations('nav');

  const tabs: Tab[] = [
    { href: '/merchants', label: t('merchants'), icon: Search, match: /^\/merchants/ },
    { href: '/promos-today', label: t('promosToday'), icon: Flame, match: /^\/promos-today/ },
    { href: '/selector', label: t('selector'), icon: BarChart3, match: /^\/selector/ },
    { href: '/account', label: t('account'), icon: UserRound, match: /^\/(account|onboarding)/ },
  ];

  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-loftly-divider bg-loftly-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-14 grid-cols-4">
        {tabs.map((tab) => {
          const active = tab.match.test(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="contents">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-caption font-medium transition-colors',
                  active ? 'text-loftly-teal' : 'text-loftly-ink-muted',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

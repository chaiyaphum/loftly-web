'use client';

import { useTranslations } from 'next-intl';
import { Flame, Search, UserRound } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { LocaleSwitcher } from './LocaleSwitcher';

/**
 * Customer header — brief §15.4 nav order with Selector demoted to a
 * right-side CTA. Sticky top on `loftly-surface` with a divider hairline.
 *
 * Auth-aware: when `isAuthed` is true the "Sign in" text link flips to
 * an "Account" link pointing at `/account`. Real avatar + dropdown is
 * a future upgrade; this just matches the logged-in user's expectation
 * that the sign-in affordance goes away once they already have a session.
 */
export function AppHeader({ isAuthed = false }: { isAuthed?: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const primary = [
    { href: '/merchants', label: t('merchants'), icon: Search, match: /^\/merchants/ },
    { href: '/promos-today', label: t('promosToday'), icon: Flame, match: /^\/promos-today/ },
    { href: '/cards', label: t('cards'), match: /^\/cards/ },
    { href: '/valuations', label: t('valuations'), match: /^\/valuations/ },
    { href: '/pricing', label: t('pricing'), match: /^\/pricing/ },
  ] as const;

  return (
    <header
      className="sticky top-0 z-40 border-b border-loftly-divider bg-loftly-surface/90 backdrop-blur-sm"
      role="banner"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link
          href="/"
          className="shrink-0 text-heading font-semibold tracking-tight text-loftly-ink"
          aria-label="Loftly — หน้าแรก"
        >
          Loftly
        </Link>

        <nav
          aria-label="Primary"
          className="ml-2 hidden min-w-0 items-center gap-1 md:flex"
        >
          {primary.map((item) => {
            const active = item.match.test(pathname);
            const Icon = 'icon' in item ? item.icon : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors',
                  active
                    ? 'bg-loftly-teal-soft text-loftly-teal'
                    : 'text-loftly-ink-muted hover:bg-loftly-teal-soft/60 hover:text-loftly-ink',
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher className="hidden sm:inline-flex" />

          <Link
            href="/selector"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-loftly-teal px-3 text-body-sm font-medium text-white shadow-subtle transition-colors hover:bg-loftly-teal-hover"
          >
            {t('selectorCta')}
          </Link>

          {isAuthed ? (
            <Link
              href="/account"
              aria-label={t('account')}
              className="hidden items-center gap-1.5 text-body-sm font-medium text-loftly-ink-muted hover:text-loftly-ink sm:inline-flex"
            >
              <UserRound className="h-4 w-4" aria-hidden />
              <span>{t('account')}</span>
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="hidden text-body-sm font-medium text-loftly-ink-muted hover:text-loftly-ink sm:inline-flex"
            >
              {t('signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

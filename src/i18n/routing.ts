import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

/**
 * next-intl routing config.
 *
 * Per UI_WEB.md §i18n spec:
 *   - Thai is default and lives at `/` (no `/th` prefix)
 *   - English lives at `/en/*`
 *   - Full parity on public routes; admin is English-only (handled separately).
 */
export const routing = defineRouting({
  locales: ['th', 'en'],
  defaultLocale: 'th',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

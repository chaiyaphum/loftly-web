'use client';

import { usePathname } from 'next/navigation';
import { AppHeader } from './AppHeader';
import { AppFooter } from './AppFooter';
import { MobileBottomNav } from './MobileBottomNav';

/**
 * Wraps customer-facing pages with the shared header, footer, and
 * mobile bottom nav. Admin, auth, and API-adjacent routes keep their
 * own chrome so this shell hides itself on those prefixes.
 */
const HIDDEN_PREFIXES = ['/admin', '/auth', '/api', '/og'];

export function SiteShell({
  children,
  isAuthed = false,
}: {
  children: React.ReactNode;
  /**
   * Server-derived auth flag (read from `loftly_session` httpOnly cookie in
   * the root layout). Passed into AppHeader + MobileBottomNav so the
   * "Sign in" link can swap to an "Account" link when the visitor has a
   * live session, without needing a client-side cookie read.
   */
  isAuthed?: boolean;
}) {
  const pathname = usePathname() ?? '/';
  const hide = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  if (hide) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader isAuthed={isAuthed} />
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col pb-20 md:pb-0">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </div>
      {/* MobileBottomNav: Account tab always routes to `/account`; the page
          itself 307s to /onboarding when no session, so both states work
          without an auth-aware variant here. */}
      <MobileBottomNav />
    </>
  );
}

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

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const hide = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  if (hide) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader />
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col pb-20 md:pb-0">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </div>
      <MobileBottomNav />
    </>
  );
}

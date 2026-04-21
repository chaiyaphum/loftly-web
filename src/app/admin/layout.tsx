import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Admin · Loftly',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin/cards', label: 'Cards' },
  { href: '/admin/articles', label: 'Articles' },
  // Re-verification sub-entry under Articles — surfaced at the top level in
  // the MVP admin because we don't yet have nested nav groups (UI_WEB.md
  // §admin). Sibling of Articles rather than a submenu keeps click depth low
  // for the weekly content sweep.
  { href: '/admin/articles/stale', label: 'Articles · Stale' },
  { href: '/admin/promos', label: 'Promos' },
  { href: '/admin/mapping-queue', label: 'Mapping queue' },
  { href: '/admin/affiliate', label: 'Affiliate' },
] as const;

/**
 * Admin layout — wraps all `/admin/**` routes.
 *
 * - Server-side guard: if no admin-role JWT cookie present, redirect to
 *   `/onboarding`. The cookie is written by the OAuth / magic-link callback
 *   routes; admin role is granted by the backend when the email matches the
 *   founder allow-list (see backend `auth.admin_emails` setting).
 * - Admin namespace is English-only per `UI_WEB.md` §i18n spec, so this layout
 *   deliberately bypasses `next-intl` for inline strings — the only i18n'd
 *   text comes from shared `admin.*` message keys where helpful.
 * - Robots meta is `noindex, nofollow` to keep admin out of search engines.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect('/onboarding?next=/admin/cards');
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="px-6 py-5">
          <Link
            href="/admin/cards"
            className="text-lg font-semibold text-loftly-ink"
          >
            Loftly Admin
          </Link>
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-6 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/admin/cards" className="font-semibold">
              Loftly Admin
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span>Signed in</span>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Logout
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

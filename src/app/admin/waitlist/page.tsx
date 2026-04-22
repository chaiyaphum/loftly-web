import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import {
  listWaitlist,
  type WaitlistList,
  type WaitlistSource,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { WaitlistClient } from './WaitlistClient';

/**
 * `/admin/waitlist` — pricing + coming-soon signup viewer.
 *
 * Server component handles the admin-session guard and the first-page fetch so
 * the page SSRs with data in hand. Pagination ("Load more") and CSV export are
 * handled client-side in `WaitlistClient` — the latter walks all pages until the
 * backend returns an empty batch, then builds a blob and triggers download.
 *
 * Pagination rationale: we intentionally keep offset state in React rather than
 * pushing it to the URL. The viewer is an internal tool — shareable deep-links
 * aren't needed, and the Load-more flow is low-complexity vs. wiring
 * router.replace on every page.
 */

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function AdminWaitlistPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect('/onboarding?next=/admin/waitlist');
  }

  const resolvedParams = (await searchParams) ?? {};
  const initialSource = parseSource(resolvedParams.source);

  let initialList: WaitlistList | null = null;
  let error: string | null = null;

  try {
    initialList = await listWaitlist(session.accessToken, {
      source: initialSource,
      limit: PAGE_SIZE,
      offset: 0,
    });
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load waitlist — please refresh.';
  }

  // English-first admin namespace — labels colocated with the page (mirrors
  // `/admin/ingestion`). Keys are shipped in `messages/{en,th}.json` under
  // `admin.waitlist.*` so later localisation is additive.
  const labels = {
    title: 'Waitlist signups',
    subtitle:
      'Emails captured from the pricing page and coming-soon landers.',
    filterSource: 'Source',
    filterAll: 'All',
    filterPricing: 'Pricing',
    filterComingSoon: 'Coming soon',
    loadMore: 'Load more',
    loadingMore: 'Loading…',
    exportCsv: 'Export CSV',
    exporting: 'Exporting…',
    exportError: 'Export failed — please try again.',
    emptyState: 'No signups yet.',
    loadError: 'Failed to load waitlist — please refresh.',
    summaryShown: (count: number) => `${count} shown`,
    columns: {
      createdAt: 'Created',
      email: 'Email',
      source: 'Source',
      variant: 'Variant',
      tier: 'Tier',
      monthlyPriceThb: 'THB / mo',
    },
  } as const;

  return (
    <section className="space-y-5" data-testid="admin-waitlist-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{labels.title}</h1>
        <p className="text-sm text-loftly-ink-muted">{labels.subtitle}</p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-loftly-danger/10 p-3 text-sm text-loftly-danger"
          data-testid="admin-waitlist-error"
        >
          {error}
        </p>
      ) : (
        <WaitlistClient
          accessToken={session!.accessToken}
          initialEntries={initialList?.data ?? []}
          initialHasMore={initialList?.pagination.has_more ?? false}
          initialSource={initialSource}
          pageSize={PAGE_SIZE}
          labels={labels}
        />
      )}
    </section>
  );
}

function parseSource(raw: string | undefined): WaitlistSource | undefined {
  if (raw === 'pricing' || raw === 'coming-soon') return raw;
  return undefined;
}

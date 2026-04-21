import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminCards, listMappingQueue } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { MappingQueueTable } from '@/components/admin/MappingQueueTable';

export const dynamic = 'force-dynamic';

/**
 * Admin namespace is English-only per `UI_WEB.md` §i18n spec, so this page
 * inlines English strings rather than wiring `next-intl`. The corresponding
 * `admin.mapping.*` keys are still maintained in `messages/{en,th}.json` so
 * the swap to `getTranslations()` is a mechanical edit once the admin console
 * gets localised.
 */

export default async function MappingQueuePage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/mapping-queue');

  let queue: Awaited<ReturnType<typeof listMappingQueue>> = {
    data: [],
    total: 0,
  };
  let cards: Awaited<ReturnType<typeof listAdminCards>> = {
    data: [],
    pagination: { has_more: false },
  };
  let error: string | null = null;
  try {
    // The mapping table + card picker load in parallel — the picker needs the
    // full active-card catalog for fuzzy lookup, and the queue is otherwise
    // unblocked by the card fetch.
    [queue, cards] = await Promise.all([
      listMappingQueue(session.accessToken),
      listAdminCards(session.accessToken, { status: 'active' }),
    ]);
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load mapping queue';
  }

  const labels = {
    columns: {
      title: 'Promo',
      bank: 'Bank',
      cardTypes: 'Raw types',
      suggested: 'Card IDs',
      action: 'Action',
    },
    bulkBar: {
      selectAll: 'Select all visible',
      assign: 'Assign',
      assignTo: (n: number) =>
        n === 1 ? 'Assign to 1 promo' : `Assign to ${n} promos`,
      cancel: 'Cancel',
      progress: (done: number, total: number) => `${done} / ${total}`,
      cardPickerPlaceholder: 'Search cards…',
      cardPickerLabel: 'Card to assign',
    },
    filter: {
      unresolvedDays: 'Unresolved for',
      days7: '> 7 days',
      days14: '> 14 days',
      days30: '> 30 days',
      all: 'All',
    },
    emptyState: 'Queue is empty.',
    emptyFiltered: 'No promos match the current filter.',
  };

  return (
    <section className="space-y-5" data-testid="mapping-queue-page">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Mapping queue</h1>
        <p className="text-sm text-slate-600">
          Unresolved promos harvested from banks — assign to cards to publish
          them.
        </p>
        <p className="text-xs text-slate-500">
          {queue.total} pending · showing {queue.data.length}
        </p>
      </header>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>
      ) : (
        <MappingQueueTable
          items={queue.data}
          cards={cards.data.map((c) => ({
            id: c.id,
            display_name: c.display_name,
            bank_slug: c.bank?.slug,
          }))}
          accessToken={session.accessToken}
          labels={labels}
        />
      )}
    </section>
  );
}

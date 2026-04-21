import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { listMappingQueue } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { MappingQueueRow } from '@/components/admin/MappingQueueRow';

export const dynamic = 'force-dynamic';

export default async function MappingQueuePage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/mapping-queue');

  let queue: Awaited<ReturnType<typeof listMappingQueue>> = {
    data: [],
    total: 0,
  };
  let error: string | null = null;
  try {
    queue = await listMappingQueue(session.accessToken);
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load mapping queue';
  }

  return (
    <section className="space-y-5">
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
      ) : queue.data.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Queue is empty.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Promo</th>
                <th className="px-4 py-2">Bank</th>
                <th className="px-4 py-2">Raw types</th>
                <th className="px-4 py-2">Card IDs</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queue.data.map((it) => (
                <MappingQueueRow
                  key={it.promo_id}
                  item={it}
                  accessToken={session.accessToken}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

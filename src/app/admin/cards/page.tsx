import Link from 'next/link';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminCards } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import type { CardStatus } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const STATUS_FILTERS: Array<CardStatus | 'all'> = [
  'all',
  'active',
  'inactive',
  'archived',
];

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const rawStatus = sp.status;
  const status =
    rawStatus && STATUS_FILTERS.includes(rawStatus as CardStatus | 'all')
      ? (rawStatus as CardStatus | 'all')
      : 'all';

  const session = await getAdminSession();

  let cards: Awaited<ReturnType<typeof listAdminCards>>['data'] = [];
  let error: string | null = null;
  try {
    const resp = await listAdminCards(session?.accessToken ?? null, {
      status: status === 'all' ? undefined : status,
    });
    cards = resp.data;
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load cards';
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Cards</h1>
        <Link
          href="/admin/cards/new"
          className="rounded-md bg-loftly-baht px-4 py-2 text-sm font-medium text-white hover:bg-loftly-baht/90"
        >
          New card
        </Link>
      </header>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((opt) => (
          <Link
            key={opt}
            href={opt === 'all' ? '/admin/cards' : `/admin/cards?status=${opt}`}
            className={
              status === opt
                ? 'rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50'
            }
          >
            {opt}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>
      ) : cards.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No cards yet. Create one to get started.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Bank</th>
                <th className="px-4 py-2">Network</th>
                <th className="px-4 py-2">Annual fee</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium">{c.display_name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {c.bank.display_name_en}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.network}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {c.annual_fee_thb != null
                      ? `THB ${new Intl.NumberFormat('en-US').format(
                          c.annual_fee_thb,
                        )}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={c.status === 'active' ? 'success' : 'outline'}
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/cards/${c.id}`}
                      className="text-loftly-sky hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

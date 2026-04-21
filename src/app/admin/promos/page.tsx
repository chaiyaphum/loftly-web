import Link from 'next/link';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminPromos } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminPromosPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string; active?: string; manual?: string }>;
}) {
  const sp = await searchParams;
  const bank = sp.bank;
  const activeFilter = sp.active === '1';
  const manualOnly = sp.manual === '1';

  const session = await getAdminSession();

  let promos: Awaited<ReturnType<typeof listAdminPromos>>['data'] = [];
  let error: string | null = null;
  try {
    const resp = await listAdminPromos(session?.accessToken ?? null, {
      bank,
      active: activeFilter || undefined,
      manual_only: manualOnly || undefined,
    });
    promos = resp.data;
  } catch (err) {
    error =
      err instanceof LoftlyAPIError ? err.message_en : 'Failed to load promos';
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Promos</h1>
        <Link
          href="/admin/promos/new"
          className="rounded-md bg-loftly-baht px-4 py-2 text-sm font-medium text-white hover:bg-loftly-baht/90"
        >
          New manual promo
        </Link>
      </header>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="bank"
          defaultValue={bank}
          placeholder="Bank slug"
          className="h-9 w-36 rounded-md border border-slate-300 px-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={activeFilter}
          />
          Active only
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="manual"
            value="1"
            defaultChecked={manualOnly}
          />
          Manual only
        </label>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
        >
          Apply
        </button>
      </form>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>
      ) : promos.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No promos match these filters.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Bank</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Valid until</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.title_th}</td>
                  <td className="px-4 py-2 text-slate-600">{p.bank_slug}</td>
                  <td className="px-4 py-2 text-slate-600">{p.promo_type}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {p.valid_until ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {p.external_source_id ? (
                      <Badge variant="outline">Synced</Badge>
                    ) : (
                      <Badge variant="warn">Manual</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.active ? (
                      <Badge variant="success">yes</Badge>
                    ) : (
                      <Badge>no</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/promos/${p.id}`}
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

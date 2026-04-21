import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import {
  getAffiliateExportUrl,
  getAffiliateStats,
  type AffiliateStats,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

function formatTHB(value: number): string {
  return `THB ${new Intl.NumberFormat('en-US').format(value)}`;
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function AdminAffiliatePage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/affiliate');

  let stats: AffiliateStats | null = null;
  let error: string | null = null;
  try {
    stats = await getAffiliateStats(session.accessToken);
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load affiliate stats';
  }

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Affiliate dashboard</h1>
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-900">{error}</p>
      </section>
    );
  }

  if (!stats) return null;

  const topByCard = [...stats.by_card]
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 10);
  const exportUrl = getAffiliateExportUrl(session.accessToken);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Affiliate dashboard</h1>
          <p className="text-sm text-slate-500">
            Last {stats.period_days} days
          </p>
        </div>
        <a
          href={exportUrl}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          download
        >
          Download CSV ▸
        </a>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Clicks" value={stats.clicks.toString()} />
        <Metric label="Conversions" value={stats.conversions.toString()} />
        <Metric
          label="Conversion rate"
          value={formatPercent(stats.conversion_rate)}
        />
        <Metric
          label="Commission pending"
          value={formatTHB(stats.commission_pending_thb)}
        />
        <Metric
          label="Commission confirmed"
          value={formatTHB(stats.commission_confirmed_thb)}
        />
        <Metric
          label="Commission paid"
          value={formatTHB(stats.commission_paid_thb)}
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-4 py-2 text-sm font-medium">
          Top 10 by card
        </div>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Card</th>
              <th className="px-4 py-2">Clicks</th>
              <th className="px-4 py-2">Conversions</th>
              <th className="px-4 py-2">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topByCard.map((r) => (
              <tr key={r.card_slug}>
                <td className="px-4 py-2 font-medium">{r.card_slug}</td>
                <td className="px-4 py-2">{r.clicks}</td>
                <td className="px-4 py-2">{r.conversions}</td>
                <td className="px-4 py-2">{formatTHB(r.commission_thb)}</td>
              </tr>
            ))}
            {topByCard.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={4}
                >
                  No card activity in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

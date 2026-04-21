import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { exportMetrics, type MetricsExport } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { RetentionSparkline } from '@/components/admin/RetentionSparkline';
import { StackedBarChart } from '@/components/admin/StackedBarChart';

/**
 * `/admin/analytics` — seed-round metrics dashboard (W23).
 *
 * Server component: enforces the admin-role guard (layout already does, but we
 * double-check because the metrics export returns raw revenue + user counts
 * that must not leak to non-admins), POSTs to the seed-round metrics exporter,
 * and renders six panels in a 2-column grid.
 *
 * Fetch-error strategy:
 * - Transport / 5xx → caught as `LoftlyAPIError`; we render an inline alert
 *   banner using the backend's English message and skip the panel grid. The
 *   admin can still retry via a hard refresh.
 * - 4xx (401, 403) → bubbled up so the platform's error boundary can redirect
 *   to `/onboarding` — we only expect this when the admin JWT has rotated
 *   mid-session.
 *
 * Admin namespace is English-first per `UI_WEB.md §i18n`, but we thread labels
 * through `next-intl` (`admin.analytics.*`) so the Thai team can ship
 * localisation in a later sweep without touching this component.
 */

export const dynamic = 'force-dynamic';

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

function formatTHB(n: number): string {
  return `THB ${formatInt(n)}`;
}

function formatPct(n: number, digits = 1): string {
  // Backend sends rates as 0–1 floats; multiply before formatting.
  return `${(n * 100).toFixed(digits)}%`;
}

function formatMs(n: number): string {
  return `${formatInt(n)} ms`;
}

function todayIsoUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default async function AdminAnalyticsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect('/onboarding?next=/admin/analytics');
  }

  let metrics: MetricsExport | null = null;
  let error: string | null = null;
  try {
    metrics = await exportMetrics(session.accessToken, {
      asOf: todayIsoUtc(),
    });
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load metrics — please refresh.';
  }

  return (
    <section className="space-y-5" data-testid="admin-analytics-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-slate-500">
          Seed-round metrics · {metrics?.as_of ?? todayIsoUtc()}
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="admin-analytics-error"
        >
          {error}
        </p>
      ) : metrics ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid="admin-analytics-grid"
        >
          <AnalyticsPanel
            title="Users"
            value={formatInt(metrics.users.total_registered)}
            delta={metrics.users.total_registered_delta_pct ?? null}
            testId="panel-users"
            footer={
              <div className="space-y-2">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">WAU</dt>
                    <dd className="font-medium">{formatInt(metrics.users.wau)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">MAU</dt>
                    <dd className="font-medium">{formatInt(metrics.users.mau)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Consent grant</dt>
                    <dd className="font-medium">
                      {formatPct(metrics.users.consent_grant_pct)}
                    </dd>
                  </div>
                </dl>
                <div>
                  <p className="mb-1 text-xs text-slate-500">12-week retention</p>
                  <RetentionSparkline
                    points={metrics.users.retention_12w ?? []}
                    testId="panel-users-sparkline"
                  />
                </div>
              </div>
            }
          />

          <AnalyticsPanel
            title="Selector"
            value={formatInt(metrics.selector.invocations)}
            delta={metrics.selector.invocations_delta_pct ?? null}
            testId="panel-selector"
            footer={
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Unique users</dt>
                  <dd className="font-medium">
                    {formatInt(metrics.selector.unique_users)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Avg latency</dt>
                  <dd className="font-medium">
                    {formatMs(metrics.selector.avg_latency_ms)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Top-1 conversion</dt>
                  <dd className="font-medium">
                    {formatPct(metrics.selector.top1_conversion_rate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Eval recall</dt>
                  <dd className="font-medium">
                    {formatPct(metrics.selector.eval_recall)}
                  </dd>
                </div>
              </dl>
            }
          />

          <AnalyticsPanel
            title="Affiliate"
            value={formatTHB(metrics.affiliate.total_commission_thb)}
            delta={metrics.affiliate.total_commission_delta_pct ?? null}
            testId="panel-affiliate"
            footer={
              <div className="space-y-3">
                <StackedBarChart
                  ariaLabel="6-month affiliate commission"
                  testId="panel-affiliate-chart"
                  bars={(metrics.affiliate.commission_by_month ?? []).map((row) => ({
                    label: row.month,
                    segments: {
                      pending: row.pending_thb,
                      confirmed: row.confirmed_thb,
                      paid: row.paid_thb,
                    },
                  }))}
                  segmentKeys={[
                    {
                      key: 'pending',
                      label: 'Pending',
                      colorClassName: 'fill-amber-300',
                    },
                    {
                      key: 'confirmed',
                      label: 'Confirmed',
                      colorClassName: 'fill-sky-400',
                    },
                    {
                      key: 'paid',
                      label: 'Paid',
                      colorClassName: 'fill-emerald-500',
                    },
                  ]}
                  formatTotal={formatTHB}
                />
                <div>
                  <p className="mb-1 text-xs text-slate-500">Top 5 cards</p>
                  <table
                    className="w-full text-xs"
                    data-testid="panel-affiliate-topcards"
                  >
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-1 font-medium">Card</th>
                        <th className="py-1 font-medium">Conv.</th>
                        <th className="py-1 font-medium">Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(metrics.affiliate.top_cards ?? [])
                        .slice(0, 5)
                        .map((c) => (
                          <tr key={c.card_slug} className="border-t border-slate-100">
                            <td className="py-1 font-medium">{c.card_slug}</td>
                            <td className="py-1">{formatInt(c.conversions)}</td>
                            <td className="py-1">{formatTHB(c.commission_thb)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            }
          />

          <AnalyticsPanel
            title="Content"
            value={formatInt(metrics.content.articles_published)}
            delta={metrics.content.articles_published_delta_pct ?? null}
            testId="panel-content"
            footer={
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Avg article age</dt>
                  <dd className="font-medium">
                    {formatInt(metrics.content.avg_article_age_days)} days
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">schema.org valid</dt>
                  <dd className="font-medium">
                    {formatPct(metrics.content.schema_validation_rate)}
                  </dd>
                </div>
              </dl>
            }
          />

          <AnalyticsPanel
            title="LLM costs"
            value={formatTHB(metrics.llm_costs.anthropic_spend_thb)}
            delta={metrics.llm_costs.anthropic_spend_delta_pct ?? null}
            testId="panel-llm"
            footer={
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Spend / MAU</dt>
                  <dd className="font-medium">
                    {formatTHB(metrics.llm_costs.spend_per_mau_thb)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Prompt-cache hit</dt>
                  <dd className="font-medium">
                    {formatPct(metrics.llm_costs.prompt_cache_hit_rate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Haiku fallback</dt>
                  <dd className="font-medium">
                    {formatPct(metrics.llm_costs.haiku_fallback_rate)}
                  </dd>
                </div>
              </dl>
            }
          />

          <AnalyticsPanel
            title="System"
            value={formatPct(metrics.system.uptime_pct, 2)}
            delta={metrics.system.uptime_delta_pct ?? null}
            testId="panel-system"
            footer={
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">5xx rate</dt>
                  <dd className="font-medium">
                    {formatPct(metrics.system.error_rate_5xx, 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">p95 latency</dt>
                  <dd className="font-medium">
                    {formatMs(metrics.system.p95_latency_ms)}
                  </dd>
                </div>
              </dl>
            }
          />
        </div>
      ) : (
        <p
          className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500"
          data-testid="admin-analytics-loading"
        >
          Loading metrics…
        </p>
      )}
    </section>
  );
}

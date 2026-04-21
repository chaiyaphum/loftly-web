import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import {
  getIngestionCoverage,
  type IngestionCoverage,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { IngestionCoverageTable } from './IngestionCoverageTable';

/**
 * `/admin/ingestion` — W16 "catalog viewer".
 *
 * The founder needs a single page that answers "where are my data gaps?" —
 * i.e. per-bank, how many promos has the deal harvester ingested, how many
 * are in the manual catalog, and when was each source last synced. This page
 * is the summary surface; drill-downs land on the existing `/admin/promos`
 * listing filtered by bank.
 *
 * Backend status (2026-04-21):
 *   - `GET /v1/admin/ingestion/coverage` is NOT yet implemented on loftly-api.
 *   - The page falls back to the bundled stub below and surfaces a visible
 *     "TODO(backend)" banner so a production admin can't mistake the stub for
 *     real numbers.
 *   - Once the endpoint ships, set `USE_STUB = false` (or delete the branch)
 *     and the page becomes live data end-to-end.
 *
 * Once the endpoint lands, remove `STUB_COVERAGE` + the banner; the typed
 * client helpers are already pointed at the correct paths.
 */

export const dynamic = 'force-dynamic';

const USE_STUB = true;

const STUB_COVERAGE: IngestionCoverage = {
  overall_coverage_pct: 72.0,
  unmapped_promos_count: 3,
  banks: [
    {
      bank_slug: 'kbank',
      bank_name: 'KBank',
      deal_harvester_count: 18,
      manual_catalog_count: 6,
      active_promos_count: 24,
      last_synced_at: '2026-04-21T10:00:00Z',
      coverage_status: 'full',
    },
    {
      bank_slug: 'scb',
      bank_name: 'SCB',
      deal_harvester_count: 12,
      manual_catalog_count: 4,
      active_promos_count: 16,
      last_synced_at: '2026-04-21T09:45:00Z',
      coverage_status: 'full',
    },
    {
      bank_slug: 'ktc',
      bank_name: 'KTC',
      deal_harvester_count: 9,
      manual_catalog_count: 5,
      active_promos_count: 14,
      last_synced_at: '2026-04-20T18:10:00Z',
      coverage_status: 'partial',
    },
    {
      bank_slug: 'uob',
      bank_name: 'UOB (Thailand)',
      deal_harvester_count: 4,
      manual_catalog_count: 7,
      active_promos_count: 10,
      last_synced_at: '2026-04-21T08:30:00Z',
      coverage_status: 'partial',
    },
    {
      bank_slug: 'citi',
      bank_name: 'Citi (Thailand)',
      deal_harvester_count: 0,
      manual_catalog_count: 2,
      active_promos_count: 2,
      last_synced_at: null,
      coverage_status: 'gap',
    },
    {
      bank_slug: 'tmb',
      bank_name: 'ttb',
      deal_harvester_count: 1,
      manual_catalog_count: 1,
      active_promos_count: 2,
      last_synced_at: '2026-04-15T12:00:00Z',
      coverage_status: 'gap',
    },
  ],
};

function formatLastSynced(iso: string | null, neverLabel: string): string {
  if (!iso) return neverLabel;
  try {
    const d = new Date(iso);
    return `${d.toISOString().slice(0, 16).replace('T', ' ')}Z`;
  } catch {
    return iso;
  }
}

export default async function AdminIngestionPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect('/onboarding?next=/admin/ingestion');
  }

  let coverage: IngestionCoverage | null = null;
  let error: string | null = null;
  let usingStub = USE_STUB;

  if (USE_STUB) {
    coverage = STUB_COVERAGE;
  } else {
    try {
      coverage = await getIngestionCoverage(session.accessToken);
    } catch (err) {
      if (err instanceof LoftlyAPIError && err.status === 404) {
        // Endpoint still missing at runtime — fall back to the stub so the
        // page stays usable for the founder instead of rendering empty.
        coverage = STUB_COVERAGE;
        usingStub = true;
      } else {
        error =
          err instanceof LoftlyAPIError
            ? err.message_en
            : 'Failed to load ingestion coverage — please refresh.';
      }
    }
  }

  const lastSyncs = (coverage?.banks ?? [])
    .map((b) => b.last_synced_at)
    .filter((s): s is string => Boolean(s))
    .sort();
  const mostRecentSync = lastSyncs[lastSyncs.length - 1] ?? null;

  // English-first admin namespace — labels colocated with the page (mirrors
  // AdminAnalyticsPage). Keys are shipped in `messages/{en,th}.json` under
  // `admin.ingestion.*` so later localisation is additive.
  const labels = {
    columns: {
      bank: 'Bank',
      dealHarvester: 'Harvester',
      manual: 'Manual',
      activeTotal: 'Active',
      lastSynced: 'Last synced',
      status: 'Status',
      actions: 'Actions',
    },
    statusLabels: {
      full: 'Full',
      partial: 'Partial',
      gap: 'Gap',
    } as const,
    viewPromos: 'View recent promos →',
    resyncCta: 'Re-sync harvester',
    resyncRunning: 'Re-syncing…',
    resyncDone: 'Re-sync queued',
    resyncMissingEndpoint: 'Re-sync endpoint not live yet (loftly-api TODO).',
    never: 'Never',
  };

  return (
    <section className="space-y-5" data-testid="admin-ingestion-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Data ingestion coverage</h1>
        <p className="text-sm text-slate-500">
          Per-bank view of deal-harvester vs. manual-catalog counts — use this
          page weekly to spot where the pipeline has gaps.
        </p>
      </header>

      {usingStub && (
        <p
          role="note"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="admin-ingestion-stub-banner"
        >
          <strong>TODO(backend):</strong> <code>GET /v1/admin/ingestion/coverage</code>{' '}
          is not live yet — numbers below are stub data for UI development.
          Companion endpoint <code>POST /v1/admin/ingestion/{'{bank_slug}'}/resync</code>{' '}
          is also pending.
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="admin-ingestion-error"
        >
          {error}
        </p>
      ) : coverage ? (
        <>
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            data-testid="admin-ingestion-summary"
          >
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Overall coverage
              </p>
              <p
                className="mt-1 text-2xl font-semibold text-slate-900"
                data-testid="admin-ingestion-overall-pct"
              >
                {coverage.overall_coverage_pct.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Unmapped promos
              </p>
              <p
                className="mt-1 text-2xl font-semibold text-slate-900"
                data-testid="admin-ingestion-unmapped"
              >
                {coverage.unmapped_promos_count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Harvested but not yet tied to a card — see{' '}
                <a
                  href="/admin/mapping-queue"
                  className="font-medium text-sky-700 hover:underline"
                >
                  mapping queue
                </a>
                .
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Most recent sync
              </p>
              <p
                className="mt-1 text-lg font-semibold text-slate-900"
                data-testid="admin-ingestion-last-sync"
              >
                {formatLastSynced(mostRecentSync, labels.never)}
              </p>
            </div>
          </div>

          <IngestionCoverageTable
            banks={coverage.banks}
            accessToken={session!.accessToken}
            labels={labels}
          />
        </>
      ) : (
        <p
          className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-500"
          data-testid="admin-ingestion-loading"
        >
          Loading ingestion coverage…
        </p>
      )}
    </section>
  );
}

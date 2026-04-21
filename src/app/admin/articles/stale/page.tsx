import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { listStaleArticles } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { StaleArticlesTable } from '@/components/admin/StaleArticlesTable';

/**
 * Stale-content re-verification UI — UI_CONTENT.md §Re-verification cadence.
 *
 * Lists published articles whose `updated_at` exceeds the configured threshold
 * (default 90 days). Filters: days-threshold, state, issuer (bank slug). Per
 * row: "Mark reviewed" (confirm modal), "Open article".
 *
 * Admin namespace is English-only per `../loftly/mvp/UI_WEB.md §i18n` — we still
 * register `admin.stale.*` i18n keys so the Thai team can localise later
 * without touching this component.
 */

export const dynamic = 'force-dynamic';

const STATE_FILTERS = ['draft', 'review', 'published', 'archived'] as const;

export default async function AdminStaleArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    state?: string;
    issuer?: string;
    page?: string;
  }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/articles/stale');

  const sp = await searchParams;
  const daysParsed = Number.parseInt(sp.days ?? '90', 10);
  const days = Number.isFinite(daysParsed) && daysParsed >= 1 ? daysParsed : 90;
  const state = (STATE_FILTERS as readonly string[]).includes(sp.state ?? '')
    ? (sp.state as (typeof STATE_FILTERS)[number])
    : 'published';
  const pageParsed = Number.parseInt(sp.page ?? '1', 10);
  const page = Number.isFinite(pageParsed) && pageParsed >= 1 ? pageParsed : 1;

  let payload: Awaited<ReturnType<typeof listStaleArticles>> | null = null;
  let error: string | null = null;
  try {
    payload = await listStaleArticles(session.accessToken, {
      days,
      state,
      issuer: sp.issuer,
      page,
    });
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load stale articles';
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Re-verify content</h1>
        <p className="text-sm text-slate-600">
          Articles with updated_at older than the threshold — review, then mark
          as re-verified.
        </p>
        {payload && payload.pagination.total > 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You have {payload.pagination.total}{' '}
            {payload.pagination.total === 1 ? 'article' : 'articles'} needing
            re-verification
          </p>
        ) : payload ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            No articles are currently overdue — nice work.
          </p>
        ) : null}
      </header>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <label className="flex flex-col text-xs text-slate-600">
          Threshold (days)
          <input
            type="number"
            name="days"
            defaultValue={days}
            min={1}
            max={3650}
            className="mt-1 w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-slate-600">
          State
          <select
            name="state"
            defaultValue={state}
            className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            {STATE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-600">
          Issuer (bank slug)
          <input
            type="text"
            name="issuer"
            defaultValue={sp.issuer ?? ''}
            placeholder="kbank"
            className="mt-1 w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {error}
        </p>
      ) : payload ? (
        <StaleArticlesTable
          items={payload.data}
          pagination={payload.pagination}
          currentQuery={{ days, state, issuer: sp.issuer ?? '', page }}
          accessToken={session.accessToken}
        />
      ) : null}
    </section>
  );
}

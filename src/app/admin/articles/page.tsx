import Link from 'next/link';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminArticles, type ArticleState } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const STATE_FILTERS: Array<ArticleState | 'all'> = [
  'all',
  'draft',
  'review',
  'published',
  'archived',
];

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; card_id?: string }>;
}) {
  const sp = await searchParams;
  const state =
    sp.state && STATE_FILTERS.includes(sp.state as ArticleState | 'all')
      ? (sp.state as ArticleState | 'all')
      : 'all';

  const session = await getAdminSession();

  let items: Awaited<ReturnType<typeof listAdminArticles>>['data'] = [];
  let error: string | null = null;
  try {
    const resp = await listAdminArticles(session?.accessToken ?? null, {
      state: state === 'all' ? undefined : state,
      card_id: sp.card_id,
    });
    items = resp.data;
  } catch (err) {
    error =
      err instanceof LoftlyAPIError
        ? err.message_en
        : 'Failed to load articles';
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Articles</h1>
        <Link
          href="/admin/articles/new"
          className="rounded-md bg-loftly-teal px-4 py-2 text-sm font-medium text-white hover:bg-loftly-teal/90"
        >
          New article
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {STATE_FILTERS.map((opt) => (
          <Link
            key={opt}
            href={
              opt === 'all' ? '/admin/articles' : `/admin/articles?state=${opt}`
            }
            className={
              state === opt
                ? 'rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded-md border border-loftly-divider px-3 py-1.5 text-xs text-loftly-ink hover:bg-loftly-teal-soft/40'
            }
          >
            {opt}
          </Link>
        ))}
        {sp.card_id && (
          <span className="text-xs text-loftly-ink-muted">
            filter: card_id={sp.card_id}
          </span>
        )}
      </div>

      {error ? (
        <p className="rounded-md bg-loftly-danger/10 p-3 text-sm text-loftly-danger">{error}</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-loftly-divider p-6 text-sm text-loftly-ink-muted">
          No articles yet.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border border-loftly-divider bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-loftly-teal-soft/40 text-left text-xs uppercase tracking-wide text-loftly-ink-muted">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">State</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium">{a.title_th}</td>
                  <td className="px-4 py-2 text-loftly-ink-muted">{a.article_type}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        a.state === 'published'
                          ? 'success'
                          : a.state === 'archived'
                            ? 'outline'
                            : 'warn'
                      }
                    >
                      {a.state}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-loftly-ink-muted">
                    {a.updated_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="text-loftly-teal hover:underline"
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

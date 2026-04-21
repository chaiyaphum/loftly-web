import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminArticles } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { ArticleForm } from '@/components/admin/ArticleForm';

export const dynamic = 'force-dynamic';

export default async function EditAdminArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect(`/onboarding?next=/admin/articles/${id}`);

  let article: Awaited<ReturnType<typeof listAdminArticles>>['data'][number] | null =
    null;
  try {
    const resp = await listAdminArticles(session.accessToken);
    article = resp.data.find((a) => a.id === id) ?? null;
  } catch (err) {
    if (err instanceof LoftlyAPIError && err.status === 401) {
      redirect('/onboarding?error=admin_required');
    }
    throw err;
  }

  if (!article) notFound();

  return (
    <section className="space-y-4">
      <nav className="text-sm">
        <Link href="/admin/articles" className="text-slate-500 hover:underline">
          ← Articles
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Edit article</h1>
      <p className="text-sm text-slate-500">
        {article.title_th} · {article.id}
      </p>
      <ArticleForm article={article} accessToken={session.accessToken} />
    </section>
  );
}

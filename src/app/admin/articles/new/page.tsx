import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { ArticleForm } from '@/components/admin/ArticleForm';

export const dynamic = 'force-dynamic';

export default async function NewAdminArticlePage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/articles/new');

  return (
    <section className="space-y-4">
      <nav className="text-sm">
        <Link href="/admin/articles" className="text-loftly-ink-muted hover:underline">
          ← Articles
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">New article</h1>
      <ArticleForm accessToken={session.accessToken} />
    </section>
  );
}

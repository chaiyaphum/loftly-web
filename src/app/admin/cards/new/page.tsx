import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { CardForm } from '@/components/admin/CardForm';

export const dynamic = 'force-dynamic';

export default async function NewAdminCardPage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/cards/new');

  return (
    <section className="space-y-4">
      <nav className="text-sm">
        <Link href="/admin/cards" className="text-slate-500 hover:underline">
          ← Cards
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">New card</h1>
      <CardForm accessToken={session.accessToken} />
    </section>
  );
}

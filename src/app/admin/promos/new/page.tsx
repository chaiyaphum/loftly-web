import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { PromoForm } from '@/components/admin/PromoForm';

export const dynamic = 'force-dynamic';

export default async function NewAdminPromoPage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/promos/new');

  return (
    <section className="space-y-4">
      <nav className="text-sm">
        <Link href="/admin/promos" className="text-loftly-ink-muted hover:underline">
          ← Promos
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">New manual promo</h1>
      <PromoForm accessToken={session.accessToken} />
    </section>
  );
}

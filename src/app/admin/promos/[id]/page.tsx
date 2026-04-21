import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminPromos } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { PromoForm } from '@/components/admin/PromoForm';

export const dynamic = 'force-dynamic';

export default async function EditAdminPromoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect(`/onboarding?next=/admin/promos/${id}`);

  let promo: Awaited<ReturnType<typeof listAdminPromos>>['data'][number] | null =
    null;
  try {
    const resp = await listAdminPromos(session.accessToken);
    promo = resp.data.find((p) => p.id === id) ?? null;
  } catch (err) {
    if (err instanceof LoftlyAPIError && err.status === 401) {
      redirect('/onboarding?error=admin_required');
    }
    throw err;
  }

  if (!promo) notFound();

  return (
    <section className="space-y-4">
      <nav className="text-sm">
        <Link href="/admin/promos" className="text-slate-500 hover:underline">
          ← Promos
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Edit promo</h1>
      <p className="text-sm text-slate-500">
        {promo.title_th} · {promo.id}
      </p>
      <PromoForm promo={promo} accessToken={session.accessToken} />
    </section>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { listAdminCards } from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';
import { CardForm } from '@/components/admin/CardForm';

export const dynamic = 'force-dynamic';

export default async function EditAdminCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getAdminSession();
  if (!session) redirect(`/onboarding?next=/admin/cards/${id}`);

  // Backend lacks a GET single-admin-card endpoint; fetch the list and find it.
  // Payload is small (< a few hundred cards); list is cheap.
  let card: Awaited<ReturnType<typeof listAdminCards>>['data'][number] | null =
    null;
  try {
    const resp = await listAdminCards(session.accessToken);
    card = resp.data.find((c) => c.id === id) ?? null;
  } catch (err) {
    if (err instanceof LoftlyAPIError && err.status === 401) {
      redirect('/onboarding?error=admin_required');
    }
    throw err;
  }

  if (!card) notFound();

  return (
    <section className="space-y-4">
      <nav className="text-sm">
        <Link href="/admin/cards" className="text-loftly-ink-muted hover:underline">
          ← Cards
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold">Edit card</h1>
      <p className="text-sm text-loftly-ink-muted">
        {card.display_name} · {card.id}
      </p>
      <CardForm card={card} accessToken={session.accessToken} />
    </section>
  );
}

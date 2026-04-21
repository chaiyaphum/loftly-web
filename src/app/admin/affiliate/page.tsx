import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/session';
import { AdminAffiliateClient } from './AdminAffiliateClient';

export const dynamic = 'force-dynamic';

/**
 * `/admin/affiliate` — admin-only affiliate stats dashboard.
 *
 * Server wrapper: enforces the admin-role guard (the shared
 * `admin/layout.tsx` already redirects unauthenticated users, but we
 * double-check here so the JWT is never passed to the client component
 * without an admin role) and hands the access token to the
 * `AdminAffiliateClient` island that owns the date-range + partner
 * filters and the CSV export trigger.
 */
export default async function AdminAffiliatePage() {
  const session = await getAdminSession();
  if (!session) redirect('/onboarding?next=/admin/affiliate');

  return <AdminAffiliateClient accessToken={session.accessToken} />;
}

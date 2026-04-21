import { InviteRequiredClient } from './InviteRequiredClient';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * Soft-launch invite-code gate page (W11, capped at 100 users).
 *
 * Rendered when middleware cannot verify `loftly_invite`. The client component
 * surfaces three pathways for the gated visitor:
 *   1. Paste an existing code (form posts to `/api/invite`, which sets the
 *      cookie and 303-redirects to `/` on success; errors come back via
 *      `?error=invalid`).
 *   2. Join the waitlist (email → `/api/invite/waitlist-join` →
 *      `POST /v1/waitlist` with `source=invite_gate`).
 *   3. Follow launch announcements (Pantip / LINE OA / X).
 */
export default async function InviteRequiredPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasError = params.error === 'invalid';

  return <InviteRequiredClient hasError={hasError} />;
}

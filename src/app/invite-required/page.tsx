import type { Metadata } from 'next';
import { InviteRequiredClient } from './InviteRequiredClient';
import { NOINDEX_METADATA } from '@/lib/seo/metadata';

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'พรีวิวเฉพาะผู้ได้รับเชิญ',
};

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

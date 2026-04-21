import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DeleteAccountClient } from './DeleteAccountClient';
import { NOINDEX_METADATA } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'ลบบัญชีของคุณ',
};

/**
 * `/account/delete` — PDPA §7 right-to-erasure self-service flow.
 *
 * Per SPEC §7 AC:
 *   - The user must type their registered email to enable the Delete CTA.
 *   - Submitting triggers a 14-day grace period; during grace the user
 *     can cancel from this same page.
 *
 * Month 3 soft-launch gate: the backend may still return 501 — the client
 * renders a "coming soon" notice rather than breaking.
 *
 * The registered email lives in the user session once auth is wired up.
 * Until then we pass `null` — the email gate still works structurally
 * because any non-empty value mismatches `null` and the confirm button
 * stays disabled. Once the session payload includes email this will just
 * start working.
 */
export default async function AccountDeletePage() {
  const t = await getTranslations('account.delete');

  // Placeholder — wire to real session when the session cookie carries
  // the user's email (pending: magic-link consume -> /me fetch).
  const registeredEmail: string | null = null;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      </header>

      <DeleteAccountClient
        registeredEmail={registeredEmail}
        initialStatus={null}
      />
    </main>
  );
}

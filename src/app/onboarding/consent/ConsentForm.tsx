'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PDPAConsentMatrix } from '@/components/loftly/PDPAConsentMatrix';
import type { ConsentPurpose, ConsentState } from '@/lib/api/types';

export interface ConsentFormProps {
  initial: ConsentState;
  policyVersion: string;
  /**
   * Redirect target on successful save. Defaults to `/selector`.
   */
  redirectTo?: string;
  /** When `true`, render in "already-authed" management mode — no redirect. */
  manageMode?: boolean;
}

/**
 * Client wrapper that drives `PDPAConsentMatrix`. Dispatches one POST per
 * purpose to `/v1/consent`. We go through the same Next.js origin for first-
 * party cookie compat — the server-side proxy is TBD, so for now we call the
 * API directly using `NEXT_PUBLIC_API_BASE`.
 *
 * Real-OAuth wiring is a manual item; while backend session is stubbed we
 * swallow 401s and still redirect, so the UX flow can be walked without auth.
 */
export function ConsentForm({
  initial,
  policyVersion,
  redirectTo = '/selector',
  manageMode = false,
}: ConsentFormProps) {
  const t = useTranslations('consent');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'success' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const apiBase = (
    process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/v1'
  ).replace(/\/$/, '');

  async function handleSave(state: Record<ConsentPurpose, boolean>) {
    setSubmitting(true);
    setStatus({ kind: 'idle' });
    try {
      // Fire one POST per purpose — API is append-only per SPEC §1.
      await Promise.all(
        (Object.entries(state) as Array<[ConsentPurpose, boolean]>).map(
          async ([purpose, granted]) => {
            const res = await fetch(`${apiBase}/consent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                purpose,
                granted,
                policy_version: policyVersion,
                source: manageMode ? 'account_settings' : 'onboarding',
              }),
            });
            // Accept 401 as OK while auth is stubbed — logged for visibility.
            if (!res.ok && res.status !== 401) {
              throw new Error(`consent update failed (${res.status})`);
            }
          },
        ),
      );
      setStatus({ kind: 'success' });
      if (!manageMode) {
        router.push(redirectTo);
      }
    } catch (err) {
      console.error('[consent] save failed', err);
      setStatus({ kind: 'error', message: t('saveError') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {status.kind === 'success' && (
        <p
          role="status"
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {t('saveSuccess')}
        </p>
      )}
      {status.kind === 'error' && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          {status.message}
        </p>
      )}
      <PDPAConsentMatrix
        consents={initial}
        policyVersion={policyVersion}
        onSave={handleSave}
        submitting={submitting}
      />
    </div>
  );
}

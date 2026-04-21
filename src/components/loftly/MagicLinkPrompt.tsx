'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestMagicLink } from '@/lib/api/auth';
import { LoftlyAPIError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

/**
 * MagicLinkPrompt — email capture shared by:
 *   - `/selector/results/[session_id]` (anon email gate per WF-3)
 *   - `/account` recovery flows later
 *
 * Props:
 *   - `sessionId?` — binds the captured email to an anonymous selector
 *     session so the consume step can redirect back to unlock results.
 *   - `source` — analytics hint (unused on backend today; future-proofed).
 *
 * Behavior:
 *   - Submit disables the form and POSTs via the `auth.requestMagicLink`
 *     helper. On success we replace the form with the Thai/En success copy
 *     that names the email address.
 *   - On error we surface `LoftlyAPIError.message_th` when available; else a
 *     generic fallback.
 */

export interface MagicLinkPromptProps {
  sessionId?: string | null;
  source?: 'selector_result' | 'account_recovery';
  className?: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MagicLinkPrompt({
  sessionId,
  className,
}: MagicLinkPromptProps) {
  const t = useTranslations('auth.magicLink');
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setState({ kind: 'error', message: t('invalidEmail') });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      await requestMagicLink(email.trim(), sessionId ?? undefined);
      setState({ kind: 'sent', email: email.trim() });
    } catch (err) {
      const msg =
        err instanceof LoftlyAPIError
          ? err.message_th || err.message_en
          : t('unknownError');
      setState({ kind: 'error', message: msg });
    }
  }

  if (state.kind === 'sent') {
    return (
      <div
        role="status"
        className={cn(
          'rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900',
          className,
        )}
      >
        {t('sentMessage', { email: state.email })}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        'flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 sm:flex-row sm:items-end',
        className,
      )}
      aria-label={t('formLabel')}
    >
      <div className="flex-1">
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {t('promptTitle')}
        </label>
        <Input
          id={inputId}
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state.kind === 'submitting'}
          aria-required="true"
          aria-invalid={state.kind === 'error' ? true : undefined}
        />
      </div>
      <Button type="submit" disabled={state.kind === 'submitting'}>
        {state.kind === 'submitting' ? t('submitting') : t('submit')}
      </Button>
      {state.kind === 'error' && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrackEvent } from '@/lib/analytics';
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
 *   - POST_V1 §2: after 30s the success panel reveals a "didn't receive?" hint
 *     + Resend button. Resend is client-side rate-limited to 1 click per 30s
 *     (re-arms the countdown on every successful send). Failures show inline
 *     error copy and re-enable after the cooldown.
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

type ResendState =
  | { kind: 'hidden' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'cooldown'; remainingSec: number }
  | { kind: 'success' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_REVEAL_MS = 30_000;
const RESEND_COOLDOWN_SEC = 30;

export function MagicLinkPrompt({
  sessionId,
  className,
}: MagicLinkPromptProps) {
  const t = useTranslations('auth.magicLink');
  const track = useTrackEvent();
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [resend, setResend] = useState<ResendState>({ kind: 'hidden' });
  const [resendError, setResendError] = useState<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearCooldownInterval = useCallback(() => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRevealTimer();
      clearCooldownInterval();
    };
  }, [clearRevealTimer, clearCooldownInterval]);

  // When we transition into `sent`, arm the 30s reveal timer.
  useEffect(() => {
    if (state.kind !== 'sent') return;
    clearRevealTimer();
    setResend({ kind: 'hidden' });
    revealTimerRef.current = setTimeout(() => {
      setResend({ kind: 'ready' });
    }, RESEND_REVEAL_MS);
    return clearRevealTimer;
  }, [state, clearRevealTimer]);

  const startCooldown = useCallback(() => {
    clearCooldownInterval();
    setResend({ kind: 'cooldown', remainingSec: RESEND_COOLDOWN_SEC });
    cooldownIntervalRef.current = setInterval(() => {
      setResend((prev) => {
        if (prev.kind !== 'cooldown') return prev;
        const next = prev.remainingSec - 1;
        if (next <= 0) {
          clearCooldownInterval();
          return { kind: 'ready' };
        }
        return { kind: 'cooldown', remainingSec: next };
      });
    }, 1000);
  }, [clearCooldownInterval]);

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

  async function handleResend() {
    if (state.kind !== 'sent') return;
    if (resend.kind === 'submitting' || resend.kind === 'cooldown') return;

    track('welcome_email_resend_clicked', {
      session_id: sessionId ?? null,
    });

    setResendError(null);
    setResend({ kind: 'submitting' });
    try {
      await requestMagicLink(state.email, sessionId ?? undefined);
      setResend({ kind: 'success' });
      // After a short beat, fall back into the cooldown to rate-limit
      // subsequent clicks to 1/30s.
      setTimeout(() => {
        startCooldown();
      }, 2500);
    } catch (err) {
      const isRate =
        err instanceof LoftlyAPIError && err.status === 429;
      const message = isRate ? t('resend.errorRate') : t('resend.errorGeneric');
      setResendError(message);
      // Start the cooldown immediately; the error message stays visible
      // alongside the countdown until the user retries.
      startCooldown();
    }
  }

  if (state.kind === 'sent') {
    return (
      <div
        className={cn(
          'rounded-md border border-emerald-200 bg-loftly-teal-soft p-4 text-sm text-loftly-teal',
          className,
        )}
      >
        <p role="status">{t('sentMessage', { email: state.email })}</p>

        {resend.kind !== 'hidden' && (
          <div className="mt-3 flex flex-col gap-2 border-t border-emerald-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-loftly-teal-hover">
              <span className="font-medium">{t('resend.hint')}</span>
              <span className="ml-1 text-loftly-teal">
                {t('resend.spamHint')}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={
                  resend.kind === 'submitting' || resend.kind === 'cooldown'
                }
                aria-label={t('resend.button')}
                data-testid="magic-link-resend-button"
              >
                {resend.kind === 'cooldown'
                  ? t('resend.cooldown', { seconds: resend.remainingSec })
                  : resend.kind === 'submitting'
                    ? t('submitting')
                    : t('resend.button')}
              </Button>
            </div>
          </div>
        )}

        {resend.kind === 'success' && (
          <p
            role="status"
            data-testid="magic-link-resend-success"
            className="mt-2 text-xs font-medium text-loftly-teal-hover"
          >
            {t('resend.success')}
          </p>
        )}

        {resendError && (
          <p
            role="alert"
            data-testid="magic-link-resend-error"
            className="mt-2 text-xs font-medium text-loftly-danger"
          >
            {resendError}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn(
        'flex flex-col gap-3 rounded-md border border-loftly-divider bg-white p-4 sm:flex-row sm:items-end',
        className,
      )}
      aria-label={t('formLabel')}
    >
      <div className="flex-1">
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-loftly-ink"
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
        <p role="alert" className="basis-full text-sm text-loftly-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

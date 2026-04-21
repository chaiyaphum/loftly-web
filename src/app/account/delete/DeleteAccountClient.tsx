'use client';

import { useCallback, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountdownTimer } from '@/components/loftly/CountdownTimer';
import {
  cancelAccountDelete,
  requestAccountDelete,
  type DeleteStatus,
} from '@/lib/api/account';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Client island for the /account/delete page.
 *
 * Gate logic (per SPEC §7 AC): the confirm button stays disabled until the
 * user types their registered email into the confirm input. If we don't
 * know the email (unauthenticated render) the gate remains active and
 * treats any non-empty value as a mismatch — the backend will enforce
 * the real check on submit.
 */

type ViewState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'cancelling'; status: DeleteStatus }
  | { kind: 'pending'; status: DeleteStatus }
  | { kind: 'cancelled' }
  | { kind: 'completed' }
  | { kind: 'not_available' }
  | { kind: 'error'; message: string };

export interface DeleteAccountClientProps {
  registeredEmail?: string | null;
  initialStatus?: DeleteStatus | null;
}

export function DeleteAccountClient({
  registeredEmail,
  initialStatus,
}: DeleteAccountClientProps) {
  const t = useTranslations('account.delete');
  const tc = useTranslations('common');
  const [, startTransition] = useTransition();

  const [typedEmail, setTypedEmail] = useState('');
  const [view, setView] = useState<ViewState>(() => {
    if (initialStatus?.status === 'pending') {
      return { kind: 'pending', status: initialStatus };
    }
    if (initialStatus?.status === 'cancelled') {
      return { kind: 'cancelled' };
    }
    if (initialStatus?.status === 'completed') {
      return { kind: 'completed' };
    }
    return { kind: 'idle' };
  });

  const emailMatches =
    typedEmail.trim().length > 0 &&
    (!!registeredEmail
      ? typedEmail.trim().toLowerCase() === registeredEmail.toLowerCase()
      : false);
  const gateEnabled = emailMatches;

  const onConfirm = useCallback(() => {
    if (!gateEnabled) return;
    startTransition(() => {
      setView({ kind: 'submitting' });
      requestAccountDelete(null)
        .then((status) => {
          if (status.status === 'pending') {
            setView({ kind: 'pending', status });
          } else if (status.status === 'completed') {
            setView({ kind: 'completed' });
          } else {
            setView({ kind: 'idle' });
          }
        })
        .catch((err: unknown) => {
          if (err instanceof LoftlyAPIError && err.status === 501) {
            setView({ kind: 'not_available' });
            return;
          }
          setView({
            kind: 'error',
            message:
              err instanceof LoftlyAPIError
                ? err.message_th || err.message_en
                : t('errorGeneric'),
          });
        });
    });
  }, [gateEnabled, t]);

  const onCancel = useCallback(() => {
    startTransition(() => {
      if (view.kind !== 'pending') return;
      setView({ kind: 'cancelling', status: view.status });
      cancelAccountDelete(null)
        .then(() => {
          setView({ kind: 'cancelled' });
        })
        .catch((err: unknown) => {
          if (err instanceof LoftlyAPIError && err.status === 501) {
            setView({ kind: 'not_available' });
            return;
          }
          setView({
            kind: 'error',
            message:
              err instanceof LoftlyAPIError
                ? err.message_th || err.message_en
                : t('errorGeneric'),
          });
        });
    });
  }, [view, t]);

  if (view.kind === 'not_available') {
    return (
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        data-testid="delete-not-available"
      >
        <p className="mb-2 font-medium">{t('notAvailableTitle')}</p>
        <p>{t('notAvailableBody')}</p>
      </div>
    );
  }

  if (view.kind === 'cancelled') {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
      >
        {t('cancelledNotice')}
      </div>
    );
  }

  if (view.kind === 'completed') {
    return (
      <div
        role="status"
        className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
      >
        {t('completedNotice')}
      </div>
    );
  }

  if (view.kind === 'pending' || view.kind === 'cancelling') {
    const status = view.status;
    const graceEndsAt = status.grace_ends_at ?? null;
    return (
      <div
        className="space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        data-testid="delete-pending"
      >
        <div>
          <p className="mb-1 font-medium">{t('pendingTitle')}</p>
          <p>
            {t('pendingBody')}{' '}
            {graceEndsAt && (
              <CountdownTimer
                targetIso={graceEndsAt}
                labels={{
                  day: 'd',
                  hour: 'h',
                  minute: 'm',
                  second: 's',
                  expired: '—',
                }}
              />
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={view.kind === 'cancelling'}
        >
          {view.kind === 'cancelling' ? t('cancelling') : t('cancelCta')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="alert"
        className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <p className="mb-1 font-medium">{t('warningTitle')}</p>
        <p>{t('warningBody')}</p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-700">{t('emailConfirmLabel')}</span>
        <Input
          type="email"
          value={typedEmail}
          onChange={(e) => setTypedEmail(e.target.value)}
          placeholder={t('emailConfirmPlaceholder')}
          autoComplete="off"
          aria-invalid={
            typedEmail.length > 0 && !emailMatches ? 'true' : undefined
          }
          data-testid="delete-email-confirm"
        />
        {typedEmail.length > 0 && !emailMatches && (
          <span className="text-xs text-red-600">{t('emailMismatch')}</span>
        )}
      </label>

      <Button
        onClick={onConfirm}
        disabled={!gateEnabled || view.kind === 'submitting'}
        className="bg-red-600 hover:bg-red-700"
        data-testid="delete-submit"
      >
        {view.kind === 'submitting' ? t('submitting') : t('confirmCta')}
      </Button>

      <section className="rounded-md bg-slate-50 p-4 text-xs text-slate-600">
        <p className="mb-1 font-medium text-slate-700">{t('legalHoldTitle')}</p>
        <p>{t('legalHoldBody')}</p>
      </section>

      {view.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <p>{view.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setView({ kind: 'idle' })}
          >
            {tc('retry')}
          </Button>
        </div>
      )}
    </div>
  );
}

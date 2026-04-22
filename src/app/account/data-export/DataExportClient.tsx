'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/loftly/CountdownTimer';
import {
  getDataExportStatus,
  requestDataExport,
  type ExportJob,
  type JobHandle,
  type JobStatus,
} from '@/lib/api/account';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Client island for the /account/data-export page.
 *
 * Responsibilities:
 *   - Post a new export job request
 *   - Poll the status endpoint every 5s until `done | failed`
 *   - Render the "coming soon" message when the backend returns 501
 *   - Handle rate-limit (429) messaging
 *
 * We intentionally do not persist the job id in a server cookie here —
 * the page-level SSR handler sets `loftly_export_job` via an embedded
 * `<form action>`-style server action in a later iteration. For MVP week
 * 7-8 we keep state in memory + localStorage so a refresh resumes polling.
 */

const POLL_MS = 5000;
const STORAGE_KEY = 'loftly_export_job';

type ViewState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'tracking'; job: JobHandle | ExportJob }
  | { kind: 'not_available'; detail?: string }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string };

export function DataExportClient({ initialJobId }: { initialJobId?: string }) {
  const t = useTranslations('account.dataExport');
  const tc = useTranslations('common');
  const [, startTransition] = useTransition();

  const [view, setView] = useState<ViewState>(() =>
    initialJobId
      ? { kind: 'tracking', job: { job_id: initialJobId, status: 'queued' } }
      : { kind: 'idle' },
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (jobId: string) => {
      try {
        const job = await getDataExportStatus(jobId, null);
        setView({ kind: 'tracking', job });
        if (job.status === 'done' || job.status === 'failed') {
          stopPolling();
          return;
        }
        timerRef.current = setTimeout(() => pollStatus(jobId), POLL_MS);
      } catch (err) {
        if (err instanceof LoftlyAPIError) {
          if (err.status === 501) {
            setView({ kind: 'not_available', detail: err.message_th });
            stopPolling();
            return;
          }
        }
        setView({
          kind: 'error',
          message:
            err instanceof LoftlyAPIError
              ? err.message_th || err.message_en
              : t('errorGeneric'),
        });
        stopPolling();
      }
    },
    [stopPolling, t],
  );

  useEffect(() => {
    if (view.kind === 'tracking') {
      const jobId = view.job.job_id;
      try {
        window.localStorage.setItem(STORAGE_KEY, jobId);
      } catch {
        /* ignore quota */
      }
      // Kick off polling if the job isn't already terminal
      if (view.job.status !== 'done' && view.job.status !== 'failed') {
        timerRef.current = setTimeout(() => pollStatus(jobId), 0);
      }
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.kind === 'tracking' ? view.job.job_id : null]);

  const onRequest = useCallback(() => {
    startTransition(() => {
      setView({ kind: 'submitting' });
      requestDataExport(null)
        .then((handle) => {
          setView({ kind: 'tracking', job: handle });
        })
        .catch((err: unknown) => {
          if (err instanceof LoftlyAPIError) {
            if (err.status === 501) {
              setView({ kind: 'not_available', detail: err.message_th });
              return;
            }
            if (err.status === 429) {
              setView({ kind: 'rate_limited' });
              return;
            }
            setView({
              kind: 'error',
              message: err.message_th || err.message_en,
            });
            return;
          }
          setView({ kind: 'error', message: t('errorGeneric') });
        });
    });
  }, [t]);

  if (view.kind === 'not_available') {
    return (
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-loftly-amber/15 p-4 text-sm text-loftly-amber-urgent"
        data-testid="export-not-available"
      >
        <p className="mb-2 font-medium">{t('notAvailableTitle')}</p>
        <p>{t('notAvailableBody')}</p>
        <p className="mt-3">
          <a href="/legal/pdpa-rights" className="underline">
            {t('pdpaLinkLabel')}
          </a>
        </p>
      </div>
    );
  }

  if (view.kind === 'rate_limited') {
    return (
      <div
        role="status"
        className="rounded-md border border-amber-200 bg-loftly-amber/15 p-4 text-sm text-loftly-amber-urgent"
      >
        {t('rateLimitNotice')}
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-loftly-danger/10 p-4 text-sm text-loftly-danger"
      >
        <p>{view.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setView({ kind: 'idle' })}
        >
          {tc('retry')}
        </Button>
      </div>
    );
  }

  if (view.kind === 'tracking') {
    const job = view.job as ExportJob;
    const statusKey: JobStatus = job.status;
    return (
      <div
        className="space-y-3 rounded-md border border-loftly-divider bg-white p-4 text-sm"
        data-testid="export-tracking"
        data-status={statusKey}
      >
        <p className="font-medium">{t(`status.${statusKey}`)}</p>
        {job.download_url && job.status === 'done' && (
          <div className="flex flex-col gap-2">
            <Button asChild>
              <a href={job.download_url} download>
                {t('downloadCta')}
              </a>
            </Button>
            {job.expires_at && (
              <span className="text-xs text-loftly-ink-muted">
                {t('expiresIn')}{' '}
                <CountdownTimer
                  targetIso={job.expires_at}
                  showSeconds
                  labels={{
                    day: 'd',
                    hour: 'h',
                    minute: 'm',
                    second: 's',
                    expired: '—',
                  }}
                />
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-loftly-ink-muted">{t('rateLimitNotice')}</p>
      </div>
    );
  }

  // idle / submitting
  return (
    <div className="space-y-3">
      <Button onClick={onRequest} disabled={view.kind === 'submitting'}>
        {view.kind === 'submitting' ? t('requesting') : t('requestCta')}
      </Button>
      <p className="text-xs text-loftly-ink-muted">{t('rateLimitNotice')}</p>
    </div>
  );
}

import { apiFetch } from './client';

/**
 * Account self-service API helpers (PDPA §7 Rights) mirroring:
 *   POST /v1/account/data-export/request
 *   GET  /v1/account/data-export/{jobId}
 *   POST /v1/account/delete/request
 *   POST /v1/account/delete/cancel
 *
 * The real endpoints currently return 501 from the backend; callers should
 * catch `LoftlyAPIError` and render a friendly "coming soon" state for the
 * 501 case. Types match `openapi.yaml` schemas.
 */

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobHandle {
  job_id: string;
  status: JobStatus;
}

export interface ExportJob extends JobHandle {
  download_url?: string | null;
  expires_at?: string | null;
}

export type DeleteStatusKind =
  | 'not_requested'
  | 'pending'
  | 'cancelled'
  | 'completed';

export interface DeleteStatus {
  status: DeleteStatusKind;
  requested_at?: string | null;
  grace_ends_at?: string | null;
}

export function requestDataExport(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<JobHandle> {
  return apiFetch<JobHandle>('/account/data-export/request', {
    method: 'POST',
    accessToken,
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

export function getDataExportStatus(
  jobId: string,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<ExportJob> {
  return apiFetch<ExportJob>(
    `/account/data-export/${encodeURIComponent(jobId)}`,
    {
      method: 'GET',
      accessToken,
      revalidate: false,
      signal: opts.signal,
    },
  );
}

export function requestAccountDelete(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<DeleteStatus> {
  return apiFetch<DeleteStatus>('/account/delete/request', {
    method: 'POST',
    accessToken,
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

export function cancelAccountDelete(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<DeleteStatus> {
  return apiFetch<DeleteStatus>('/account/delete/cancel', {
    method: 'POST',
    accessToken,
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

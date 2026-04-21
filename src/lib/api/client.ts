import type { ErrorEnvelope } from './types';

/**
 * Thin fetch wrapper for `loftly-api`.
 *
 * - Base URL from `NEXT_PUBLIC_API_BASE` (default local dev endpoint).
 * - Typed response; parses the Error envelope from `openapi.yaml` and throws
 *   `LoftlyAPIError` on 4xx/5xx with `{ code, message_th, message_en, status }`.
 * - 5s request timeout (AbortController).
 * - 1 retry on 5xx with 500ms backoff. 4xx responses do NOT retry.
 *
 * Server-side session token forwarding is stubbed for now — callers pass
 * `accessToken = null` when hitting public routes; later we'll wire this up to
 * an auth helper that reads the encrypted session cookie server-side.
 */

export const DEFAULT_API_BASE = 'http://localhost:8000/v1';

export class LoftlyAPIError extends Error {
  readonly code: string;
  readonly message_th?: string;
  readonly message_en: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(init: {
    code: string;
    message_en: string;
    message_th?: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(init.message_en);
    this.name = 'LoftlyAPIError';
    this.code = init.code;
    this.message_en = init.message_en;
    this.message_th = init.message_th;
    this.status = init.status;
    this.details = init.details;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** When omitted or null, no Authorization header is sent. */
  accessToken?: string | null;
  /** Forwarded to fetch for Next.js server-side caching. */
  revalidate?: number | false;
  /** Per-call override; default 5000ms. */
  timeoutMs?: number;
  /** Default 1; set 0 to disable retries. */
  maxRetries?: number;
  /** Abort signal from the caller (e.g. Next.js request). */
  signal?: AbortSignal;
}

export function getApiBase(): string {
  // `NEXT_PUBLIC_*` vars are inlined at build time. Trim trailing slash.
  const raw = process.env.NEXT_PUBLIC_API_BASE || DEFAULT_API_BASE;
  return raw.replace(/\/$/, '');
}

function buildUrl(
  path: string,
  query?: ApiRequestOptions['query'],
): string {
  const base = getApiBase();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Record<string, unknown>;
  if (!maybe.error || typeof maybe.error !== 'object') return false;
  const err = maybe.error as Record<string, unknown>;
  return typeof err.code === 'string' && typeof err.message_en === 'string';
}

async function parseError(
  response: Response,
): Promise<LoftlyAPIError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body — fall through with generic shape.
  }

  if (isErrorEnvelope(body)) {
    return new LoftlyAPIError({
      code: body.error.code,
      message_en: body.error.message_en,
      message_th: body.error.message_th,
      status: response.status,
      details: body.error.details,
    });
  }

  return new LoftlyAPIError({
    code: `http_${response.status}`,
    message_en: `Request failed with status ${response.status}`,
    status: response.status,
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    if (signal) {
      const abortHandler = () => {
        clearTimeout(id);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }
  });
}

export async function apiFetch<T>(
  path: string,
  opts: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    accessToken,
    revalidate,
    timeoutMs = 5000,
    maxRetries = 1,
    signal,
  } = opts;

  const url = buildUrl(path, query);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let attempt = 0;
  // 1 retry = 2 total tries when maxRetries=1.
  const maxAttempts = Math.max(1, maxRetries + 1);

  for (;;) {
    attempt += 1;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const composedSignal = signal
      ? composeSignals(controller.signal, signal)
      : controller.signal;

    try {
      const init: RequestInit & { next?: { revalidate?: number | false } } = {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: composedSignal,
      };
      if (revalidate !== undefined) {
        init.next = { revalidate };
      }

      const response = await fetch(url, init);
      clearTimeout(timeoutId);

      if (response.ok) {
        // 204 / empty body handling:
        if (response.status === 204) {
          return undefined as T;
        }
        return (await response.json()) as T;
      }

      // 5xx — retry once with backoff; 4xx — bail immediately.
      if (response.status >= 500 && attempt < maxAttempts) {
        await delay(500, signal);
        continue;
      }

      throw await parseError(response);
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof LoftlyAPIError) {
        throw err;
      }

      // AbortError: timeout or caller aborted.
      if (isAbortError(err)) {
        if (signal?.aborted) throw err;
        if (attempt < maxAttempts) {
          await delay(500, signal);
          continue;
        }
        throw new LoftlyAPIError({
          code: 'request_timeout',
          message_en: `Request timed out after ${timeoutMs}ms`,
          message_th: 'คำขอหมดเวลา กรุณาลองใหม่',
          status: 0,
        });
      }

      // Network error — retry once.
      if (attempt < maxAttempts) {
        await delay(500, signal);
        continue;
      }

      const message = err instanceof Error ? err.message : 'Network error';
      throw new LoftlyAPIError({
        code: 'network_error',
        message_en: message,
        message_th: 'เครือข่ายขัดข้อง',
        status: 0,
      });
    }
  }
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || (err as { code?: string }).code === 'ABORT_ERR')
  );
}

function composeSignals(
  a: AbortSignal,
  b: AbortSignal,
): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    // Node 20+ / modern browsers.
    return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([a, b]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (a.aborted || b.aborted) controller.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

/**
 * SSE consumer for `/v1/selector/{session_id}?stream=true&token=…`.
 *
 * Contract (per SPEC §2 / AI_PROMPTS.md):
 *   - Server emits named events:
 *     - `envelope`    → initial SelectorResult shell (stack, totals)
 *     - `rationale`   → incremental text chunk; append to rationale panel
 *     - `done`        → close; final payload is the accumulated rationale
 *     - `error`       → abort with upstream error envelope
 *
 * Reconnect behavior:
 *   - On transport `error` (connection drop) the client attempts up to
 *     `maxRetries` reopens with exponential backoff (default 1s, 2s, 4s).
 *   - A terminal close (EventSource readyState === CLOSED after the error
 *     fires, indicating the browser won't auto-reconnect — typically a 401/403
 *     or 404 response) skips retry so we don't hammer the auth endpoint.
 *   - Each reconnect carries `?resume_from={last_seq}` so the backend can
 *     (in the future) skip re-emitting rationale chunks we already have.
 *     Current backend ignores this param; duplicate chunks are accepted.
 *
 * Falls back to polling `GET /v1/selector/{id}` when `EventSource` is not
 * available (server components) or when all retries are exhausted before the
 * initial envelope.
 */

import type { SelectorResult } from './types';
import { getApiBase } from './client';
import { getSelectorResult } from './selector';

export interface SSEHandlers {
  onEnvelope?: (envelope: SelectorResult) => void;
  onRationaleChunk?: (chunk: string) => void;
  onDone?: (result: SelectorResult) => void;
  onError?: (err: Error) => void;
  /**
   * Fired when the connection drops and we've scheduled a retry.
   * `attempt` is 1-indexed (first retry is `attempt === 1`).
   */
  onReconnect?: (attempt: number) => void;
  /**
   * Fired after all retries are exhausted and we've given up. UI should show
   * a "disconnected permanently" state and (optionally) fall back to the SSR
   * rationale. Not called for terminal errors (auth failures).
   */
  onReconnectGiveUp?: () => void;
}

export interface SSEStreamOptions extends SSEHandlers {
  /** Max reconnect attempts after initial open. Default 3. */
  maxRetries?: number;
  /** Backoff in ms for a given retry number (1-indexed). Default 2^attempt * 500 → 1000/2000/4000. */
  backoffMs?: (attempt: number) => number;
}

export interface SSEController {
  close: () => void;
}

const DEFAULT_MAX_RETRIES = 3;
const defaultBackoff = (attempt: number): number =>
  Math.pow(2, attempt) * 500; // 1s, 2s, 4s, 8s, …

export function openSelectorStream(
  sessionId: string,
  token: string | null,
  handlers: SSEStreamOptions,
): SSEController {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    // Non-browser / unsupported — fall back to one-shot fetch.
    const controller = new AbortController();
    void getSelectorResult(sessionId, token, { signal: controller.signal })
      .then((result) => {
        handlers.onEnvelope?.(result);
        handlers.onDone?.(result);
      })
      .catch((err) =>
        handlers.onError?.(err instanceof Error ? err : new Error(String(err))),
      );
    return { close: () => controller.abort() };
  }

  const maxRetries = handlers.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffMs = handlers.backoffMs ?? defaultBackoff;

  // Client-side state that survives reconnects.
  let accumulator: SelectorResult | null = null;
  let rationale = '';
  let lastSeq = -1; // incremented per rationale chunk received
  let retryAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let userClosed = false;
  let doneReceived = false;
  let currentEs: EventSource | null = null;

  function buildUrl(): string {
    const base = getApiBase();
    const url = new URL(`${base}/selector/${encodeURIComponent(sessionId)}`);
    url.searchParams.set('stream', 'true');
    if (token) url.searchParams.set('token', token);
    if (lastSeq >= 0) url.searchParams.set('resume_from', String(lastSeq));
    return url.toString();
  }

  function cleanup() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (currentEs) {
      currentEs.close();
      currentEs = null;
    }
  }

  function connect() {
    if (userClosed || doneReceived) return;

    const es = new EventSource(buildUrl(), { withCredentials: true });
    currentEs = es;

    es.addEventListener('envelope', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as SelectorResult;
        accumulator = parsed;
        // Only surface envelope once — subsequent reconnects may re-emit it
        // but the UI has already rendered the initial shell.
        if (retryAttempt === 0) {
          handlers.onEnvelope?.(parsed);
        }
      } catch (err) {
        handlers.onError?.(err as Error);
      }
    });

    es.addEventListener('rationale', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          delta?: string;
          seq?: number;
        };
        const chunk = data.delta ?? '';
        // If the server honors resume_from, seq increments naturally.
        // If not, we accept dupes — the UI handles this by appending.
        if (typeof data.seq === 'number') {
          lastSeq = data.seq;
        } else {
          lastSeq += 1;
        }
        rationale += chunk;
        handlers.onRationaleChunk?.(chunk);
        // Successful chunk after a reconnect: reset attempt counter so a
        // later drop gets a full retry budget.
        if (retryAttempt > 0) {
          retryAttempt = 0;
        }
      } catch (err) {
        handlers.onError?.(err as Error);
      }
    });

    es.addEventListener('done', () => {
      doneReceived = true;
      const final: SelectorResult = {
        ...(accumulator ?? ({} as SelectorResult)),
        rationale_th: rationale || (accumulator?.rationale_th ?? ''),
      };
      handlers.onDone?.(final);
      cleanup();
    });

    es.addEventListener('error', () => {
      // Ignore errors after we've already received `done` or the caller closed.
      if (doneReceived || userClosed) {
        cleanup();
        return;
      }

      // Terminal close: readyState CLOSED (2) means the browser won't
      // auto-reconnect — typically 401/403/404 or CORS. Do not retry.
      // readyState CONNECTING (0) means the browser is trying to reconnect
      // (network blip). We still close and take over retry scheduling so we
      // control backoff + give-up signaling.
      const terminal = es.readyState === EventSource.CLOSED;
      es.close();
      currentEs = null;

      if (terminal) {
        // Don't retry auth failures. Surface the error and (if no envelope
        // yet) one-shot fetch the result.
        handlers.onError?.(new Error('SSE terminal error (auth or not found)'));
        if (!accumulator) {
          void getSelectorResult(sessionId, token)
            .then((result) => handlers.onEnvelope?.(result))
            .catch((err) =>
              handlers.onError?.(
                err instanceof Error ? err : new Error(String(err)),
              ),
            );
        }
        return;
      }

      if (retryAttempt >= maxRetries) {
        handlers.onReconnectGiveUp?.();
        // Best-effort fallback if we never got an envelope.
        if (!accumulator) {
          void getSelectorResult(sessionId, token)
            .then((result) => handlers.onEnvelope?.(result))
            .catch((err) =>
              handlers.onError?.(
                err instanceof Error ? err : new Error(String(err)),
              ),
            );
        }
        return;
      }

      retryAttempt += 1;
      const delay = backoffMs(retryAttempt);
      handlers.onReconnect?.(retryAttempt);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    });
  }

  connect();

  return {
    close: () => {
      userClosed = true;
      cleanup();
    },
  };
}

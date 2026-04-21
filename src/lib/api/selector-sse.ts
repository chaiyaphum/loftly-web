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
 * Falls back to polling `GET /v1/selector/{id}` when `EventSource` is not
 * available (server components) or when the stream errors before yielding.
 */

import type { SelectorResult } from './types';
import { getApiBase } from './client';
import { getSelectorResult } from './selector';

export interface SSEHandlers {
  onEnvelope?: (envelope: SelectorResult) => void;
  onRationaleChunk?: (chunk: string) => void;
  onDone?: (result: SelectorResult) => void;
  onError?: (err: Error) => void;
}

export interface SSEController {
  close: () => void;
}

export function openSelectorStream(
  sessionId: string,
  token: string | null,
  handlers: SSEHandlers,
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

  const base = getApiBase();
  const url = new URL(
    `${base}/selector/${encodeURIComponent(sessionId)}`,
  );
  url.searchParams.set('stream', 'true');
  if (token) url.searchParams.set('token', token);

  const es = new EventSource(url.toString(), { withCredentials: true });

  let accumulator: SelectorResult | null = null;
  let rationale = '';

  es.addEventListener('envelope', (ev) => {
    try {
      const parsed = JSON.parse((ev as MessageEvent).data) as SelectorResult;
      accumulator = parsed;
      handlers.onEnvelope?.(parsed);
    } catch (err) {
      handlers.onError?.(err as Error);
    }
  });

  es.addEventListener('rationale', (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as { delta?: string };
      const chunk = data.delta ?? '';
      rationale += chunk;
      handlers.onRationaleChunk?.(chunk);
    } catch (err) {
      handlers.onError?.(err as Error);
    }
  });

  es.addEventListener('done', () => {
    const final: SelectorResult = {
      ...(accumulator ?? ({} as SelectorResult)),
      rationale_th: rationale || (accumulator?.rationale_th ?? ''),
    };
    handlers.onDone?.(final);
    es.close();
  });

  es.addEventListener('error', (ev) => {
    // EventSource error event doesn't carry a message; if we've already got an
    // envelope we surface the partial result + swallow the close noise.
    if (accumulator) {
      handlers.onDone?.(accumulator);
    } else {
      handlers.onError?.(new Error('SSE connection failed'));
      // Fallback to one-shot fetch if we never received an envelope.
      void getSelectorResult(sessionId, token)
        .then((result) => handlers.onEnvelope?.(result))
        .catch((err) =>
          handlers.onError?.(
            err instanceof Error ? err : new Error(String(err)),
          ),
        );
    }
    es.close();
    void ev; // consume
  });

  return {
    close: () => es.close(),
  };
}

'use client';

import * as React from 'react';
import { openSelectorStream } from '@/lib/api/selector-sse';

interface Props {
  sessionId: string;
  token?: string | null;
  /** Server-rendered fallback rationale — displayed when SSE is unavailable. */
  fallback: string;
  streamingLabel: string;
  /**
   * Shown as a toast-style line beneath the rationale when SSE disconnects
   * AFTER at least one chunk has arrived (i.e. user is looking at the partial
   * stream, not the fallback). When omitted, no disconnect hint renders.
   */
  disconnectedLabel?: string;
  /**
   * Shown while the client is waiting for a reconnect attempt. Optional —
   * renders only when supplied.
   */
  reconnectingLabel?: string;
  /** If `false` (the default), no stream opens and we simply show fallback. */
  enabled?: boolean;
}

/**
 * Progressively appends rationale chunks from `/v1/selector/{id}?stream=true`.
 *
 * - When `enabled` is false, renders the SSR `fallback` unchanged.
 * - When enabled and EventSource is available, opens a stream; chunks replace
 *   the fallback as they arrive. If the stream errors before yielding, we
 *   revert to `fallback`. If the stream errors mid-stream (after ≥1 chunk),
 *   the client attempts up to 3 reconnects with exponential backoff
 *   (1s, 2s, 4s). While reconnecting we show `reconnectingLabel`; if all
 *   retries fail we keep the partial text and surface `disconnectedLabel`.
 * - No-op on SSR (`typeof window`): parent renders fallback directly.
 */
export function StreamingRationale({
  sessionId,
  token = null,
  fallback,
  streamingLabel,
  disconnectedLabel,
  reconnectingLabel,
  enabled = false,
}: Props) {
  const [text, setText] = React.useState<string>(fallback);
  const [streaming, setStreaming] = React.useState<boolean>(false);
  const [reconnecting, setReconnecting] = React.useState<number>(0);
  const [disconnected, setDisconnected] = React.useState<boolean>(false);
  // Track whether any chunk arrived — decides fallback vs partial-keep on error.
  const receivedChunkRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    setText('');
    setStreaming(true);
    setReconnecting(0);
    setDisconnected(false);
    receivedChunkRef.current = false;
    const ctrl = openSelectorStream(sessionId, token, {
      onRationaleChunk: (chunk) => {
        receivedChunkRef.current = true;
        // A successful chunk clears any mid-flight reconnect banner.
        setReconnecting(0);
        setText((prev) => prev + chunk);
      },
      onDone: (result) => {
        setStreaming(false);
        setReconnecting(0);
        if (result.rationale_th) {
          setText(result.rationale_th);
        }
      },
      onReconnect: (attempt) => {
        setReconnecting(attempt);
      },
      onReconnectGiveUp: () => {
        setStreaming(false);
        setReconnecting(0);
        if (receivedChunkRef.current) {
          // Mid-stream disconnect — keep partial text + show toast.
          setDisconnected(true);
        } else {
          // Never connected — fall back to SSR rationale.
          setText(fallback);
        }
      },
      onError: () => {
        // Terminal (auth/not-found) or pre-envelope fallback path: no retry
        // will happen. Revert to fallback unless we already have partial text.
        setStreaming(false);
        setReconnecting(0);
        if (receivedChunkRef.current) {
          setDisconnected(true);
        } else {
          setText(fallback);
        }
      },
    });
    return () => ctrl.close();
  }, [enabled, sessionId, token, fallback]);

  return (
    <div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-loftly-ink">
        {text}
      </p>
      {streaming && reconnecting === 0 && (
        <p className="mt-1 text-xs italic text-loftly-ink-muted/70" aria-live="polite">
          {streamingLabel}
        </p>
      )}
      {reconnecting > 0 && reconnectingLabel && (
        <p
          className="mt-1 text-xs text-amber-600"
          role="status"
          aria-live="polite"
          data-testid="streaming-reconnecting"
        >
          {reconnectingLabel}
        </p>
      )}
      {disconnected && disconnectedLabel && (
        <p
          className="mt-1 text-xs text-loftly-amber-urgent"
          role="status"
          aria-live="polite"
          data-testid="streaming-disconnected"
        >
          {disconnectedLabel}
        </p>
      )}
    </div>
  );
}

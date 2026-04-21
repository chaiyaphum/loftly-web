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
 *   we keep the partial text and surface `disconnectedLabel` as a toast —
 *   no jarring re-render back to the full fallback.
 * - No-op on SSR (`typeof window`): parent renders fallback directly.
 */
export function StreamingRationale({
  sessionId,
  token = null,
  fallback,
  streamingLabel,
  disconnectedLabel,
  enabled = false,
}: Props) {
  const [text, setText] = React.useState<string>(fallback);
  const [streaming, setStreaming] = React.useState<boolean>(false);
  const [disconnected, setDisconnected] = React.useState<boolean>(false);
  // Track whether any chunk arrived — decides fallback vs partial-keep on error.
  const receivedChunkRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    setText('');
    setStreaming(true);
    setDisconnected(false);
    receivedChunkRef.current = false;
    const ctrl = openSelectorStream(sessionId, token, {
      onRationaleChunk: (chunk) => {
        receivedChunkRef.current = true;
        setText((prev) => prev + chunk);
      },
      onDone: (result) => {
        setStreaming(false);
        if (result.rationale_th) {
          setText(result.rationale_th);
        }
      },
      onError: () => {
        setStreaming(false);
        if (receivedChunkRef.current) {
          // Mid-stream disconnect — keep partial text + show toast.
          setDisconnected(true);
        } else {
          // Never connected — fall back to SSR rationale.
          setText(fallback);
        }
      },
    });
    return () => ctrl.close();
  }, [enabled, sessionId, token, fallback]);

  return (
    <div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
        {text}
      </p>
      {streaming && (
        <p className="mt-1 text-xs italic text-slate-400" aria-live="polite">
          {streamingLabel}
        </p>
      )}
      {disconnected && disconnectedLabel && (
        <p
          className="mt-1 text-xs text-amber-700"
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

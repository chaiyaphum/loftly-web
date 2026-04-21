'use client';

import * as React from 'react';
import { openSelectorStream } from '@/lib/api/selector-sse';

interface Props {
  sessionId: string;
  token?: string | null;
  /** Server-rendered fallback rationale — displayed when SSE is unavailable. */
  fallback: string;
  streamingLabel: string;
  /** If `false` (the default), no stream opens and we simply show fallback. */
  enabled?: boolean;
}

/**
 * Progressively appends rationale chunks from `/v1/selector/{id}?stream=true`.
 *
 * - When `enabled` is false, renders the SSR `fallback` unchanged.
 * - When enabled and EventSource is available, opens a stream; chunks replace
 *   the fallback as they arrive. If the stream errors before yielding, we
 *   revert to `fallback`.
 * - No-op on SSR (`typeof window`): parent renders fallback directly.
 */
export function StreamingRationale({
  sessionId,
  token = null,
  fallback,
  streamingLabel,
  enabled = false,
}: Props) {
  const [text, setText] = React.useState<string>(fallback);
  const [streaming, setStreaming] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!enabled) return;
    setText('');
    setStreaming(true);
    const ctrl = openSelectorStream(sessionId, token, {
      onRationaleChunk: (chunk) => {
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
        setText(fallback);
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
    </div>
  );
}

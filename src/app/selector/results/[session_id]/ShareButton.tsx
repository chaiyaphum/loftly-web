'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Copy-to-clipboard share button for `/selector/results/[session_id]`.
 *
 * Privacy:
 *   The share URL intentionally excludes the original selector query
 *   (spend breakdown, goal, horizon) because those details could leak
 *   through referrer headers or paste history. The URL reuses only
 *   `session_id` from the current path — recipients see the same stack
 *   but NOT the user's spending profile. A `token` query param, if any,
 *   is also stripped — it's a magic-link unlock specific to the sender.
 */

interface Props {
  /**
   * Session ID to share. Required even though we could read it from the
   * current URL — explicit prop keeps the component testable without JSDOM
   * URL tweaking.
   */
  sessionId: string;
  className?: string;
  /**
   * Override for the copy target. When omitted we derive it from
   * `window.location.origin` + `/selector/results/{sessionId}`. Used by
   * tests to inject a stable URL.
   */
  resolveUrl?: () => string;
}

type ToastState = 'idle' | 'copied' | 'failed';

const RESET_MS = 2000;

function defaultResolveUrl(sessionId: string): string {
  if (typeof window === 'undefined') return '';
  // Strip any search params / hash — we only want the canonical session path.
  return `${window.location.origin}/selector/results/${encodeURIComponent(sessionId)}`;
}

export function ShareButton({ sessionId, className, resolveUrl }: Props) {
  const t = useTranslations('selector.results.share');
  const [toast, setToast] = React.useState<ToastState>('idle');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    const url = resolveUrl ? resolveUrl() : defaultResolveUrl(sessionId);
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('clipboard_unavailable');
      }
      setToast('copied');
    } catch {
      setToast('failed');
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast('idle'), RESET_MS);
    }
  }, [resolveUrl, sessionId]);

  return (
    <span className={className} data-testid="share-button-root">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        aria-label={t('ariaLabel')}
        data-testid="share-copy-button"
      >
        {toast === 'copied' ? t('copied') : t('copy')}
      </Button>
      {toast !== 'idle' && (
        <span
          role="status"
          aria-live="polite"
          data-testid="share-toast"
          data-state={toast}
          className="ml-2 text-xs text-slate-600"
        >
          {toast === 'copied' ? t('copied') : t('copyFailed')}
        </span>
      )}
    </span>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type {
  ConsentPurpose,
  ConsentState,
} from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * 4-toggle PDPA consent matrix (WF-5 in UI_WEB.md).
 *
 * Behavior per SPEC.md §1 acceptance criteria:
 *   - `optimization` is required and locked ON; attempting to submit with it
 *     off triggers a blocking error
 *   - `marketing`, `analytics`, `sharing` default OFF
 *   - On submit, parent caller handles the POST to `/v1/consent` per purpose
 *     via the `onSave` callback
 *
 * Render-only; no direct fetch call here.
 */

const PURPOSES: ConsentPurpose[] = [
  'optimization',
  'marketing',
  'analytics',
  'sharing',
];

export interface PDPAConsentMatrixProps {
  consents: ConsentState;
  policyVersion: string;
  onSave: (state: Record<ConsentPurpose, boolean>) => Promise<void> | void;
  submitting?: boolean;
  className?: string;
}

export function PDPAConsentMatrix({
  consents,
  policyVersion,
  onSave,
  submitting = false,
  className,
}: PDPAConsentMatrixProps) {
  const t = useTranslations('consent');
  const tCommon = useTranslations('common');

  const initial: Record<ConsentPurpose, boolean> = useMemo(
    () => ({
      // `optimization` is always locked ON — matches SPEC §1.
      optimization: true,
      marketing: Boolean(consents.consents?.marketing),
      analytics: Boolean(consents.consents?.analytics),
      sharing: Boolean(consents.consents?.sharing),
    }),
    [consents],
  );

  const [state, setState] = useState<Record<ConsentPurpose, boolean>>(initial);
  const [error, setError] = useState<string | null>(null);

  const setPurpose = (purpose: ConsentPurpose, next: boolean) => {
    if (purpose === 'optimization' && !next) {
      // SPEC §1: blocking error when optimization toggled off.
      setError(t('optimizationRequiredError'));
      return;
    }
    setError(null);
    setState((prev) => ({ ...prev, [purpose]: next }));
  };

  const handleSubmit = async () => {
    if (!state.optimization) {
      setError(t('optimizationRequiredError'));
      return;
    }
    setError(null);
    await onSave(state);
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-4">
        {PURPOSES.map((purpose) => {
          const locked = purpose === 'optimization';
          const inputId = `consent-${purpose}`;
          return (
            <div
              key={purpose}
              className="flex items-start justify-between gap-4 rounded-md border border-loftly-divider p-4"
            >
              <div>
                <label htmlFor={inputId} className="text-base font-medium">
                  {t(`purposes.${purpose}.title`)}
                  {locked && (
                    <span className="ml-2 text-xs font-normal text-loftly-amber">
                      {t('required')}
                    </span>
                  )}
                </label>
                <p
                  className="mt-1 text-sm text-loftly-ink-muted"
                  id={`${inputId}-desc`}
                >
                  {t(`purposes.${purpose}.description`)}
                </p>
              </div>
              <Switch
                id={inputId}
                checked={state[purpose]}
                onCheckedChange={(next) => setPurpose(purpose, next)}
                disabled={locked || submitting}
                aria-describedby={`${inputId}-desc`}
                aria-label={t(`purposes.${purpose}.title`)}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-loftly-danger/10 p-3 text-sm text-loftly-danger"
        >
          {error}
        </p>
      )}

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-loftly-ink-muted">
          {t('policyVersion', { version: policyVersion })}
        </p>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? tCommon('saving') : t('submit')}
        </Button>
      </div>
    </div>
  );
}

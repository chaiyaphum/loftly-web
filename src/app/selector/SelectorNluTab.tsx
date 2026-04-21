'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { parseSpendNlu } from '@/lib/api/selector';
import { LoftlyAPIError } from '@/lib/api/client';
import type { SpendNLUResponse, SpendProfile } from '@/lib/api/types';
import { useTrackEvent } from '@/lib/analytics';
import {
  defaultSelectorValues,
  type SelectorDraftValues,
} from '@/lib/schemas/selector';

/**
 * Free-text Thai NLU tab for the Selector (W19, DEV_PLAN).
 *
 * Behind the `typhoon_nlu_spend` PostHog flag — this component is only
 * rendered when the flag resolves to `true`. See `src/lib/feature-flags.ts`.
 *
 * Contract:
 *   - Textarea accepts 30–600 chars of Thai free-text.
 *   - "Parse" button POSTs to `/v1/selector/parse-nlu` with `{ text_th }`.
 *   - On success, maps the returned `SpendProfile` (fractional categories,
 *     goal: miles/cashback/flexible) to the Selector form's shape
 *     (THB amounts, goal: miles/cashback/benefits) and calls `onParsed`.
 *   - On HTTP 501 the feature is actually off — we call `onDisabled` so the
 *     parent can hide the tab entirely and fall back to the structured form.
 *   - HTTP 502 / 504 stay on this tab; inline error + retry allowed.
 *
 * Analytics: every submit fires `typhoon_nlu_submitted` with
 * `{ char_count, duration_ms, success }`.
 */

export const NLU_MIN_CHARS = 30;
export const NLU_MAX_CHARS = 600;

export interface SelectorNluTabProps {
  /** Called with seed values for the structured form when parse succeeds. */
  onParsed: (seed: SelectorDraftValues) => void;
  /**
   * Called when the backend returns 501 — the flag is off server-side or
   * the Typhoon key is unset. Parent should hide the tab and stay on the
   * structured form.
   */
  onDisabled: () => void;
  /** Called when the user clicks "Back to form" without parsing. */
  onBack: () => void;
}

type ErrorKind = 'unparseable' | 'timeout' | 'generic';

export function SelectorNluTab({
  onParsed,
  onDisabled,
  onBack,
}: SelectorNluTabProps) {
  const t = useTranslations('selector.nlu');
  const track = useTrackEvent();
  const [text, setText] = useState('');
  const [error, setError] = useState<ErrorKind | null>(null);
  const [validationError, setValidationError] = useState<
    'too_short' | 'too_long' | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const charCount = text.length;
  const isTooShort = charCount > 0 && charCount < NLU_MIN_CHARS;
  const isTooLong = charCount > NLU_MAX_CHARS;
  const canSubmit =
    !isPending && charCount >= NLU_MIN_CHARS && charCount <= NLU_MAX_CHARS;

  function handleParse(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    if (charCount < NLU_MIN_CHARS) {
      setValidationError('too_short');
      return;
    }
    if (charCount > NLU_MAX_CHARS) {
      setValidationError('too_long');
      return;
    }

    const startedAt = performance.now();
    startTransition(async () => {
      try {
        const result = await parseSpendNlu({ text_th: text });
        const duration = Math.round(performance.now() - startedAt);
        track('typhoon_nlu_submitted', {
          char_count: charCount,
          duration_ms: duration,
          success: true,
        });
        onParsed(profileToDraft(result));
      } catch (err) {
        const duration = Math.round(performance.now() - startedAt);
        track('typhoon_nlu_submitted', {
          char_count: charCount,
          duration_ms: duration,
          success: false,
        });
        if (err instanceof LoftlyAPIError) {
          if (err.status === 501) {
            onDisabled();
            return;
          }
          if (err.status === 502) {
            setError('unparseable');
            return;
          }
          if (err.status === 504 || err.code === 'request_timeout') {
            setError('timeout');
            return;
          }
        }
        setError('generic');
      }
    });
  }

  const errorKey =
    error === 'unparseable'
      ? 'error_unparseable'
      : error === 'timeout'
        ? 'error_timeout'
        : error === 'generic'
          ? 'error_generic'
          : null;

  const validationKey = validationError;

  return (
    <form onSubmit={handleParse} className="space-y-4">
      <label htmlFor="nlu-text" className="block text-base font-medium text-slate-900">
        {t('tab_label')}
      </label>
      <textarea
        id="nlu-text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setValidationError(null);
          setError(null);
        }}
        rows={6}
        maxLength={NLU_MAX_CHARS + 50 /* soft buffer; we validate on submit */}
        placeholder={t('placeholder')}
        aria-invalid={Boolean(validationKey)}
        aria-describedby="nlu-char-count"
        disabled={isPending}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
      />
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span
          id="nlu-char-count"
          className={isTooShort || isTooLong ? 'text-red-700' : undefined}
        >
          {t('char_count_hint', { count: charCount })}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="text-sky-700 underline-offset-2 hover:underline"
        >
          {t('back_to_form')}
        </button>
      </div>

      {validationKey && (
        <p role="alert" className="text-sm text-red-700">
          {t(validationKey)}
        </p>
      )}

      {errorKey && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {t(errorKey)}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!canSubmit}>
          {isPending ? t('button_parsing') : t('button_parse')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Map the backend `SpendProfile` (fractional categories, goals
 * miles/cashback/flexible) onto the structured-form draft shape
 * (THB amounts, goals miles/cashback/benefits).
 *
 * Mapping rules:
 *   - `default` fraction → `other` bucket (`petrol` folds into `other` too
 *     since the UI form doesn't expose petrol — the Selector form schema
 *     omits it per `src/lib/schemas/selector.ts`).
 *   - Goal `flexible` → `benefits` (closest UI analog).
 *   - When `goal === 'miles'` we leave the downstream miles subfields on
 *     their sensible defaults (ROP / 12mo / 90k) so the user reviews
 *     before submitting.
 */
export function profileToDraft(
  response: SpendNLUResponse,
): SelectorDraftValues {
  const defaults = defaultSelectorValues();
  const total = response.profile.monthly_spend_thb;
  const cats = response.profile.spend_categories;
  const thb = (frac: number | undefined) =>
    Math.round(((frac ?? 0) * total) / 100) * 100; // 100-THB granularity

  const dining = thb(cats.dining);
  const online = thb(cats.online);
  const travel = thb(cats.travel);
  const grocery = thb(cats.grocery);
  // Fold both backend `default` and `petrol` into the UI `other` bucket.
  const other = Math.max(
    0,
    total - (dining + online + travel + grocery),
  );

  const goalType = mapGoal(response.profile.goal);

  return {
    monthly_spend_thb: total,
    spend_categories: { dining, online, travel, grocery, other },
    current_cards: [],
    goal:
      goalType === 'miles'
        ? {
            type: 'miles',
            currency_preference: defaults.goal.currency_preference,
            horizon_months: defaults.goal.horizon_months,
            target_points: defaults.goal.target_points,
          }
        : { type: goalType },
    locale: defaults.locale,
  };
}

function mapGoal(
  goal: SpendProfile['goal'],
): SelectorDraftValues['goal']['type'] {
  switch (goal) {
    case 'miles':
      return 'miles';
    case 'cashback':
      return 'cashback';
    case 'flexible':
    default:
      return 'benefits';
  }
}

'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SpendCategorySliders } from '@/components/loftly/SpendCategorySliders';
import { GoalPicker } from '@/components/loftly/GoalPicker';
import {
  defaultSelectorValues,
  selectorFormSchema,
  type SelectorDraftValues,
  type SelectorFormValues,
} from '@/lib/schemas/selector';
import { submitSelector } from '@/lib/api/selector';
import { LoftlyAPIError } from '@/lib/api/client';
import type { SelectorInput } from '@/lib/api/types';

/**
 * Client-side driver for WF-2. Owns form state, runs zod validation on
 * submit, POSTs to `/v1/selector`, and navigates to the result page with
 * the returned `session_id`.
 *
 * Field-level inline errors are kept terse — the zod issue codes map to
 * localized strings from `messages/*.json selector.errors.*`.
 */
export interface SelectorFormProps {
  /**
   * Optional seed values for the form (used by the NLU tab to auto-fill
   * after parsing). When omitted, the form resets to `defaultSelectorValues()`.
   */
  initialValues?: SelectorDraftValues;
  /**
   * Optional review-hint banner rendered above the form — shown when values
   * were auto-filled from free-text so the user knows to sanity-check.
   */
  reviewHint?: React.ReactNode;
}

export function SelectorForm({ initialValues, reviewHint }: SelectorFormProps = {}) {
  const t = useTranslations('selector');
  const tErr = useTranslations('selector.errors');
  const locale = useLocale() as 'th' | 'en';
  const router = useRouter();
  const [values, setValues] = useState<SelectorDraftValues>(
    () => initialValues ?? defaultSelectorValues(),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateTotal(next: number) {
    setValues((prev) => {
      // Keep the residual bucket in sync when the user edits the total.
      const editableSum =
        prev.spend_categories.dining +
        prev.spend_categories.online +
        prev.spend_categories.travel +
        prev.spend_categories.grocery;
      const other = Math.max(0, next - editableSum);
      return {
        ...prev,
        monthly_spend_thb: next,
        spend_categories: { ...prev.spend_categories, other },
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    const parsed = selectorFormSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        const key = typeof issue.message === 'string' ? issue.message : 'invalid';
        errs[path] = safeErr(tErr, key);
      }
      setFieldErrors(errs);
      return;
    }

    const input: SelectorInput = {
      monthly_spend_thb: parsed.data.monthly_spend_thb,
      spend_categories: parsed.data.spend_categories,
      current_cards: parsed.data.current_cards,
      goal: parsed.data.goal,
      locale,
    };

    startTransition(async () => {
      try {
        const result = await submitSelector(input);
        router.push(`/selector/results/${encodeURIComponent(result.session_id)}`);
      } catch (err) {
        if (err instanceof LoftlyAPIError) {
          setSubmitError(err.message_th || err.message_en);
        } else {
          setSubmitError(tErr('submitFailed'));
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {reviewHint ? (
        <div
          role="status"
          className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
        >
          {reviewHint}
        </div>
      ) : null}
      {/* Total spend */}
      <section className="space-y-2">
        <label
          htmlFor="monthly-spend"
          className="block text-base font-medium text-slate-900"
        >
          {t('monthlySpendLabel')}
        </label>
        <p className="text-xs text-slate-500">{t('monthlySpendHint')}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">THB</span>
          <Input
            id="monthly-spend"
            type="number"
            min={5000}
            max={2_000_000}
            step={1000}
            value={values.monthly_spend_thb}
            onChange={(e) => updateTotal(Number(e.target.value) || 0)}
            aria-describedby="monthly-spend-hint"
            aria-invalid={Boolean(fieldErrors.monthly_spend_thb)}
            className="max-w-[12rem]"
          />
        </div>
        {fieldErrors.monthly_spend_thb && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.monthly_spend_thb}
          </p>
        )}
      </section>

      {/* Category sliders */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-slate-900">
          {t('categoriesLabel')}
        </h2>
        <SpendCategorySliders
          total={values.monthly_spend_thb}
          categories={values.spend_categories}
          onChange={(next) =>
            setValues((prev) => ({ ...prev, spend_categories: next }))
          }
          disabled={isPending}
        />
        {fieldErrors.spend_categories && (
          <p role="alert" className="text-sm text-red-700">
            {fieldErrors.spend_categories}
          </p>
        )}
      </section>

      {/* Goal */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-slate-900">{t('goalLabel')}</h2>
        <GoalPicker
          value={values.goal}
          onChange={(next) => setValues((prev) => ({ ...prev, goal: next }))}
          disabled={isPending}
        />
        {Object.entries(fieldErrors)
          .filter(([k]) => k.startsWith('goal'))
          .map(([k, msg]) => (
            <p key={k} role="alert" className="text-sm text-red-700">
              {msg}
            </p>
          ))}
      </section>

      {/* Current cards placeholder */}
      <section className="space-y-2">
        <h2 className="text-base font-medium text-slate-900">
          {t('currentCardsLabel')}
        </h2>
        <p className="text-xs text-slate-500">{t('currentCardsHint')}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            aria-disabled="true"
          >
            {t('addCardPlaceholder')}
          </Button>
          <span className="text-xs text-slate-400">{t('skip')}</span>
        </div>
      </section>

      {submitError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {submitError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}

function safeErr(
  tErr: ReturnType<typeof useTranslations<'selector.errors'>>,
  key: string,
): string {
  // Unknown zod issue codes fall back to a generic localized message.
  try {
    // next-intl throws when the key is missing; catch + fall back.
    return tErr(key as Parameters<typeof tErr>[0]);
  } catch {
    return tErr('invalid');
  }
}

// Re-export the zod-inferred type for tests + co-located callers.
export type { SelectorFormValues };
export { z };

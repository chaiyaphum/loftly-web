'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Slider } from '@/components/ui/slider';
import { formatTHBFull } from '@/components/loftly/ThaiNumberFormat';
import {
  UI_SPEND_CATEGORIES,
  type SpendCategoriesForm,
  type UiSpendCategory,
} from '@/lib/schemas/selector';
import { cn } from '@/lib/utils';

/**
 * Category-spend allocation sliders (WF-2 bottom half).
 *
 * Behavior:
 *   - Total THB is pinned to `total` (the parent-controlled monthly spend).
 *   - Moving any slider reallocates the residual into `other` so the sum
 *     always equals `total`.
 *   - Arrow keys step THB 1,000 (a11y baseline in UI_WEB.md).
 *   - Values are clamped to [0, total] per slider.
 *
 * Controlled: parent owns `categories`, we only dispatch updates via
 * `onChange`. This keeps the reducer/zod validation in one place.
 */

export interface SpendCategorySlidersProps {
  total: number;
  categories: SpendCategoriesForm;
  onChange: (next: SpendCategoriesForm) => void;
  disabled?: boolean;
  className?: string;
}

const STEP_THB = 1000;

export function SpendCategorySliders({
  total,
  categories,
  onChange,
  disabled = false,
  className,
}: SpendCategorySlidersProps) {
  const t = useTranslations('selector.categories');
  const idBase = useId();

  function handleChange(cat: UiSpendCategory, raw: number) {
    // Editable categories are every UI category except `other` — `other`
    // always absorbs the residual so the sum is pinned to `total`.
    if (cat === 'other') return;
    const clamped = Math.max(0, Math.min(total, Math.round(raw)));

    // Sum of non-touched, non-other categories.
    const otherEditableSum = (UI_SPEND_CATEGORIES as readonly UiSpendCategory[])
      .filter((c) => c !== cat && c !== 'other')
      .reduce((acc, c) => acc + categories[c], 0);

    // If the user over-pulls past `total - otherEditableSum`, residual would
    // go negative; clamp accordingly and let `other` go to zero.
    const maxForCat = Math.max(0, total - otherEditableSum);
    const nextCatValue = Math.min(clamped, maxForCat);
    const residual = total - otherEditableSum - nextCatValue;

    onChange({
      ...categories,
      [cat]: nextCatValue,
      other: Math.max(0, residual),
    });
  }

  return (
    <div className={cn('space-y-4', className)}>
      {(UI_SPEND_CATEGORIES as readonly UiSpendCategory[]).map((cat) => {
        const inputId = `${idBase}-${cat}`;
        const value = categories[cat];
        const isResidual = cat === 'other';
        return (
          <div key={cat} className="grid grid-cols-[7rem_1fr_6.5rem] items-center gap-3">
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-slate-700"
            >
              {t(cat)}
              {isResidual && (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {t('residualHint')}
                </span>
              )}
            </label>
            <Slider
              id={inputId}
              min={0}
              max={total}
              step={STEP_THB}
              value={value}
              onValueChange={(n) => handleChange(cat, n)}
              disabled={disabled || isResidual}
              aria-label={t(cat)}
              aria-valuetext={formatTHBFull(value)}
            />
            <span
              className="text-right text-sm tabular-nums text-slate-700"
              data-testid={`spend-value-${cat}`}
            >
              {formatTHBFull(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

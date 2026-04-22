'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
  COMMON_CURRENCIES,
  HORIZON_OPTIONS,
  type CommonCurrencyCode,
  type HorizonMonths,
} from '@/lib/schemas/selector';
import type { SelectorGoal, SelectorGoalType } from '@/lib/api/types';
import { cn } from '@/lib/utils';

/**
 * GoalPicker — WF-2 "เป้าหมาย" section.
 *
 * Three goal types (miles / cashback / benefits) rendered as a radio group.
 * Only `miles` shows contextual fields (currency + horizon + target points)
 * per SPEC §2. The other two goals are zero-field radios.
 *
 * Controlled: parent passes `value` (a SelectorGoal), we emit the next
 * SelectorGoal via `onChange`. The parent zod schema reconciles required
 * fields when submit is attempted.
 */

export interface GoalPickerProps {
  value: SelectorGoal;
  onChange: (next: SelectorGoal) => void;
  disabled?: boolean;
  className?: string;
}

const GOAL_TYPES: readonly SelectorGoalType[] = ['miles', 'cashback', 'benefits'] as const;

export function GoalPicker({
  value,
  onChange,
  disabled = false,
  className,
}: GoalPickerProps) {
  const t = useTranslations('selector.goal');
  const nameId = useId();

  function setType(type: SelectorGoalType) {
    if (type === 'miles') {
      onChange({
        type: 'miles',
        currency_preference:
          (value.currency_preference as CommonCurrencyCode | undefined) ?? 'ROP',
        horizon_months: (value.horizon_months as HorizonMonths | undefined) ?? 12,
        target_points: value.target_points ?? 90_000,
      });
    } else {
      onChange({ type });
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div
        role="radiogroup"
        aria-label={t('groupLabel')}
        className="grid gap-2 sm:grid-cols-3"
      >
        {GOAL_TYPES.map((type) => {
          const checked = value.type === type;
          const id = `${nameId}-${type}`;
          return (
            <label
              key={type}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors',
                checked
                  ? 'border-loftly-teal bg-loftly-teal/5'
                  : 'border-loftly-divider hover:bg-loftly-teal-soft/40',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                id={id}
                type="radio"
                name={nameId}
                value={type}
                checked={checked}
                disabled={disabled}
                onChange={() => setType(type)}
                className="mt-0.5 h-4 w-4 accent-loftly-teal"
                aria-describedby={`${id}-desc`}
              />
              <span className="flex-1">
                <span className="block font-medium text-loftly-ink">
                  {t(`types.${type}.label`)}
                </span>
                <span
                  id={`${id}-desc`}
                  className="mt-0.5 block text-xs text-loftly-ink-muted"
                >
                  {t(`types.${type}.description`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {value.type === 'miles' && (
        <div className="grid gap-3 rounded-md border border-loftly-divider bg-loftly-teal-soft/40 p-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor={`${nameId}-currency`}
              className="mb-1 block text-xs font-medium text-loftly-ink-muted"
            >
              {t('currencyLabel')}
            </label>
            <select
              id={`${nameId}-currency`}
              value={value.currency_preference ?? 'ROP'}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  type: 'miles',
                  currency_preference: e.target.value,
                })
              }
              className="h-10 w-full rounded-md border border-loftly-divider bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loftly-teal"
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {t(`currencyOptions.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${nameId}-horizon`}
              className="mb-1 block text-xs font-medium text-loftly-ink-muted"
            >
              {t('horizonLabel')}
            </label>
            <select
              id={`${nameId}-horizon`}
              value={value.horizon_months ?? 12}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  type: 'miles',
                  horizon_months: Number(e.target.value),
                })
              }
              className="h-10 w-full rounded-md border border-loftly-divider bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loftly-teal"
            >
              {HORIZON_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {t('horizonOption', { months: h })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${nameId}-target`}
              className="mb-1 block text-xs font-medium text-loftly-ink-muted"
            >
              {t('targetPointsLabel')}
            </label>
            <Input
              id={`${nameId}-target`}
              type="number"
              min={1000}
              step={1000}
              value={value.target_points ?? ''}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...value,
                  type: 'miles',
                  target_points: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { z } from 'zod';

/**
 * Zod schema for the Card Selector input form.
 *
 * Mirrors openapi.yaml `SelectorInput` with a UI-side refinement:
 *   - `monthly_spend_thb` integer, THB 5,000 – 2,000,000 (matches backend)
 *   - `spend_categories` map of the 5 UX-visible categories (petrol is kept
 *     backend-only for now; UI has dining/online/travel/grocery/other)
 *   - Category sum must be within ±THB 100 of `monthly_spend_thb` — slider
 *     UI pins total, but rounding tolerance is allowed so the form never
 *     rejects a legitimate user input.
 *   - `goal.type` radio; when `miles`, `currency_preference`, `horizon_months`,
 *     and `target_points` are required.
 *
 * This is the single source of truth for client-side validation — never
 * duplicate the rules in JSX.
 */

export const UI_SPEND_CATEGORIES = [
  'dining',
  'online',
  'travel',
  'grocery',
  'other',
] as const;

export type UiSpendCategory = (typeof UI_SPEND_CATEGORIES)[number];

export const COMMON_CURRENCIES = [
  'ROP',
  'KF',
  'AM',
  'BONVOY',
  'K_POINT',
] as const;

export type CommonCurrencyCode = (typeof COMMON_CURRENCIES)[number];

export const HORIZON_OPTIONS = [6, 12, 24] as const;

export type HorizonMonths = (typeof HORIZON_OPTIONS)[number];

/** Absolute tolerance, in THB, between slider sum and total spend. */
export const CATEGORY_SUM_TOLERANCE_THB = 100;

const spendCategoriesSchema = z.object({
  dining: z.number().int().min(0),
  online: z.number().int().min(0),
  travel: z.number().int().min(0),
  grocery: z.number().int().min(0),
  other: z.number().int().min(0),
});

export type SpendCategoriesForm = z.infer<typeof spendCategoriesSchema>;

const goalSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('miles'),
      currency_preference: z.enum(COMMON_CURRENCIES),
      horizon_months: z
        .number()
        .int()
        .refine(
          (n) => (HORIZON_OPTIONS as readonly number[]).includes(n),
          { message: 'invalid_horizon' },
        ),
      target_points: z.number().int().min(1000),
    }),
    z.object({ type: z.literal('cashback') }),
    z.object({ type: z.literal('benefits') }),
  ]);

export const selectorFormSchema = z
  .object({
    monthly_spend_thb: z
      .number()
      .int()
      .min(5000, { message: 'spend_too_low' })
      .max(2_000_000, { message: 'spend_too_high' }),
    spend_categories: spendCategoriesSchema,
    current_cards: z.array(z.string()).default([]),
    goal: goalSchema,
    locale: z.enum(['th', 'en']).default('th'),
  })
  .superRefine((val, ctx) => {
    const sum =
      val.spend_categories.dining +
      val.spend_categories.online +
      val.spend_categories.travel +
      val.spend_categories.grocery +
      val.spend_categories.other;
    if (Math.abs(sum - val.monthly_spend_thb) > CATEGORY_SUM_TOLERANCE_THB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['spend_categories'],
        message: 'category_sum_mismatch',
      });
    }
  });

export type SelectorFormValues = z.infer<typeof selectorFormSchema>;

/**
 * Looser draft type used by the controlled form. We don't enforce the
 * discriminated-union narrowing on every keystroke — zod runs on submit and
 * surfaces the right error. This mirrors the shape emitted by `GoalPicker`.
 */
export interface SelectorDraftValues {
  monthly_spend_thb: number;
  spend_categories: SpendCategoriesForm;
  current_cards: string[];
  goal: {
    type: 'miles' | 'cashback' | 'benefits';
    currency_preference?: string | null;
    horizon_months?: number | null;
    target_points?: number | null;
  };
  locale: 'th' | 'en';
}

/**
 * Default form state used by /selector — THB 80k baseline per UI_WEB.md WF-2,
 * evenly-ish pre-allocated across the five categories.
 */
export function defaultSelectorValues(): SelectorDraftValues {
  return {
    monthly_spend_thb: 80_000,
    spend_categories: {
      dining: 15_000,
      online: 20_000,
      travel: 25_000,
      grocery: 10_000,
      other: 10_000,
    },
    current_cards: [],
    goal: {
      type: 'miles',
      currency_preference: 'ROP',
      horizon_months: 12,
      target_points: 90_000,
    },
    locale: 'th',
  };
}

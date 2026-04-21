/**
 * Hand-coded TypeScript types mirroring the schemas in
 * `../loftly/mvp/artifacts/openapi.yaml`. We prefer generated types later
 * (orval / openapi-typescript); this file is the bridge until then.
 *
 * Golden test: `tests/api.types.test.ts` parses a sample JSON payload and
 * verifies the shapes compile.
 */

export type CurrencyType = 'bank_proprietary' | 'airline' | 'hotel';

export interface Currency {
  code: string;
  display_name_en: string;
  display_name_th: string;
  currency_type: CurrencyType;
  issuing_entity?: string | null;
}

export interface Valuation {
  currency: Currency;
  thb_per_point: number;
  methodology: string;
  percentile: number;
  sample_size: number;
  /** 0..1 */
  confidence: number;
  top_redemption_example?: string | null;
  computed_at: string;
}

export interface ValuationDetail extends Valuation {
  distribution_summary?: Record<string, number>;
  history?: Array<{ thb_per_point: number; computed_at: string }>;
}

export interface SignupBonus {
  bonus_points: number;
  spend_required: number;
  timeframe_days: number;
}

export interface Bank {
  slug: string;
  display_name_en: string;
  display_name_th: string;
}

export type CardNetwork =
  | 'Visa'
  | 'Mastercard'
  | 'Amex'
  | 'JCB'
  | 'UnionPay'
  | string;

export type CardStatus = 'active' | 'inactive' | 'archived';

export interface Card {
  id: string;
  slug: string;
  display_name: string;
  bank: Bank;
  tier?: string | null;
  network: CardNetwork;
  annual_fee_thb?: number | null;
  annual_fee_waiver?: string | null;
  min_income_thb?: number | null;
  min_age?: number | null;
  earn_currency: Currency;
  earn_rate_local: Record<string, number>;
  earn_rate_foreign?: Record<string, number> | null;
  benefits: Record<string, unknown>;
  signup_bonus?: SignupBonus | null;
  description_th?: string | null;
  description_en?: string | null;
  status: CardStatus;
}

export interface Pagination {
  cursor_next?: string | null;
  has_more: boolean;
  total_estimate?: number;
}

export interface CardList {
  data: Card[];
  pagination: Pagination;
}

export interface ValuationList {
  data: Valuation[];
}

export type ConsentPurpose =
  | 'optimization'
  | 'marketing'
  | 'analytics'
  | 'sharing';

export interface ConsentState {
  policy_version: string;
  consents: Record<ConsentPurpose, boolean>;
}

export interface ConsentUpdate {
  purpose: ConsentPurpose;
  granted: boolean;
  policy_version: string;
  source?: 'onboarding' | 'account_settings' | 'selector' | 'admin';
}

export type SelectorGoalType = 'miles' | 'cashback' | 'benefits';

export interface SelectorGoal {
  type: SelectorGoalType;
  currency_preference?: string | null;
  horizon_months?: number | null;
  target_points?: number | null;
}

export type SelectorCategory =
  | 'dining'
  | 'online'
  | 'travel'
  | 'grocery'
  | 'petrol'
  | 'other';

export interface SelectorInput {
  monthly_spend_thb: number;
  /** keys in {dining, online, travel, grocery, petrol, other} per openapi.yaml */
  spend_categories: Record<string, number>;
  current_cards?: string[];
  goal: SelectorGoal;
  locale: 'th' | 'en';
}

/**
 * Alias for openapi.yaml SelectorResult.stack items. The upstream schema does
 * not give the inline type a name, so we re-export it under the
 * `SelectorStackCard` alias required by downstream consumers (selector UI,
 * tests) while keeping `SelectorStackItem` for backward compat.
 */
export interface SelectorStackItem {
  card_id: string;
  slug: string;
  role: 'primary' | 'secondary' | 'tertiary';
  monthly_earning_points: number;
  monthly_earning_thb_equivalent: number;
  annual_fee_thb?: number | null;
  reason_th: string;
  reason_en?: string | null;
}

export type SelectorStackCard = SelectorStackItem;

export interface SelectorResult {
  session_id: string;
  stack: SelectorStackItem[];
  total_monthly_earning_points: number;
  total_monthly_earning_thb_equivalent: number;
  months_to_goal?: number | null;
  with_signup_bonus_months?: number | null;
  valuation_confidence: number;
  rationale_th: string;
  rationale_en?: string | null;
  warnings: string[];
  llm_model: string;
  fallback: boolean;
  partial_unlock?: boolean;
}

export interface MagicLinkRequest {
  email: string;
  session_id?: string | null;
}

export interface MagicLinkConsume {
  token: string;
}

export interface TokenPairUser {
  id: string;
  email: string;
  locale: 'th' | 'en';
  role: 'user' | 'admin';
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  /** seconds */
  expires_in: number;
  user?: TokenPairUser;
}

export interface Promo {
  id: string;
  bank_slug: string;
  external_source_id?: string | null;
  source_url: string;
  promo_type:
    | 'category_bonus'
    | 'cashback'
    | 'transfer_bonus'
    | 'signup'
    | 'statement_credit'
    | 'dining_program';
  title_th: string;
  title_en?: string | null;
  description_th?: string | null;
  merchant_name?: string | null;
  category?: string | null;
  discount_type?: string | null;
  discount_value?: string | null;
  discount_amount?: number | null;
  discount_unit?: string | null;
  minimum_spend?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  card_ids: string[];
  active: boolean;
}

/** Error envelope, matching openapi.yaml `components.schemas.Error`. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message_en: string;
    message_th?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Projected `transfer_ratios` row for the compare widget.
 * Mirrors `CardComparison.transfer_partners[]` from `loftly-api`.
 */
export interface TransferPartner {
  destination_code: string;
  destination_display_name_en: string;
  destination_display_name_th: string;
  ratio_source: number;
  ratio_destination: number;
  bonus_percentage: number;
}

/** Most-recent `point_valuations` snapshot bundled with a comparison row. */
export interface CardValuationSnapshot {
  thb_per_point: number;
  methodology: string;
  confidence: number;
  sample_size: number;
}

/**
 * Enriched card payload used by `GET /v1/cards/compare` — superset of `Card`
 * with transfer partners, valuation snapshot, and a Loftly score (0–5).
 */
export interface CardComparison {
  card: Card;
  transfer_partners: TransferPartner[];
  valuation?: CardValuationSnapshot | null;
  loftly_score?: number | null;
}

export interface CardComparisonList {
  data: CardComparison[];
}

export interface CardSimilarList {
  data: Card[];
}

/**
 * Free-text NLU (Typhoon) parse result — mirrors `loftly-api`
 * `src/loftly/schemas/spend_nlu.py`.
 *
 * `spend_categories` values are **fractional allocations** in [0, 1] summing
 * to ~1.0. The client multiplies by `monthly_spend_thb` before populating
 * the structured Selector form (which uses THB amounts, not fractions).
 */
export type SpendNluCategory =
  | 'dining'
  | 'online'
  | 'grocery'
  | 'travel'
  | 'petrol'
  | 'default';

export type SpendNluGoal = 'miles' | 'cashback' | 'flexible';

export interface SpendProfile {
  monthly_spend_thb: number;
  spend_categories: Partial<Record<SpendNluCategory, number>>;
  goal: SpendNluGoal;
}

export interface SpendNLURequest {
  text_th: string;
}

export interface SpendNLUResponse {
  profile: SpendProfile;
  confidence: number;
  model: string;
  duration_ms: number;
}

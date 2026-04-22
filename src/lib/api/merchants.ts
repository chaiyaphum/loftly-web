import { apiFetch } from './client';

/**
 * Merchant Reverse Lookup API helpers — `/v1/merchants/*` endpoints.
 *
 * Backs the `/merchants/[slug]` surface that answers "which card is
 * best at X?" with ranked cards × active promos × est-THB-value. See
 * `loftly` repo `mvp/POST_V1.md §9` (ratified 2026-04-22 Q18).
 *
 * All endpoints are public; anon and authed callers both hit them. When
 * auth is wired later, we'll forward the session token to scope results
 * to the user's wallet (`user_owns`).
 */

export type MerchantType =
  | 'retail'
  | 'fnb'
  | 'ecommerce'
  | 'travel'
  | 'service';

export type MerchantStatus =
  | 'active'
  | 'pending_review'
  | 'merged'
  | 'disabled';

export interface MerchantCanonical {
  id: string;
  slug: string;
  display_name_th: string;
  display_name_en: string;
  category_default: string | null;
  alt_names: string[];
  logo_url: string | null;
  description_th: string | null;
  description_en: string | null;
  merchant_type: MerchantType;
  status: MerchantStatus;
}

export interface MerchantSearchResult {
  slug: string;
  display_name: string;
  logo_url: string | null;
  active_promo_count: number;
  category_default: string | null;
}

export interface PromoSummary {
  id: string;
  title_th: string;
  title_en: string | null;
  discount_value: string | null;
  valid_until: string | null;
}

export interface MerchantRankedCard {
  card_slug: string;
  display_name: string;
  bank_display_name_th: string | null;
  base_earn_rate: number;
  applicable_promos: PromoSummary[];
  est_value_per_1000_thb: number;
  confidence: number;
  applied_rules: string[];
  affiliate_apply_url: string | null;
  user_owns: boolean;
}

export interface HreflangAlternate {
  locale: string;
  href: string;
}

export interface MerchantPageData {
  merchant: MerchantCanonical;
  ranked_cards: MerchantRankedCard[];
  generated_at: string;
  valuation_snapshot_id: string | null;
  canonical_url: string;
  hreflang_alternates: HreflangAlternate[];
}

export interface MerchantListItem {
  slug: string;
  display_name_th: string;
  display_name_en: string;
  category_default: string | null;
  merchant_type: MerchantType;
  active_promo_count: number;
}

export interface MerchantListResponse {
  data: MerchantListItem[];
  total: number;
  category: string | null;
  letter: string | null;
}

export function searchMerchants(
  q: string,
  opts: { locale?: string; signal?: AbortSignal } = {},
): Promise<MerchantSearchResult[]> {
  return apiFetch<MerchantSearchResult[]>('/merchants/search', {
    method: 'GET',
    query: { q, locale: opts.locale ?? 'th' },
    accessToken: null,
    revalidate: 300,
    signal: opts.signal,
    timeoutMs: 4_000,
    maxRetries: 0,
  });
}

export function getMerchantPage(
  slug: string,
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<MerchantPageData> {
  return apiFetch<MerchantPageData>(
    `/merchants/${encodeURIComponent(slug)}`,
    {
      method: 'GET',
      accessToken: opts.accessToken ?? null,
      revalidate: 300,
      signal: opts.signal,
      timeoutMs: 8_000,
      maxRetries: 1,
    },
  );
}

export function listMerchants(
  opts: {
    category?: string;
    letter?: string;
    signal?: AbortSignal;
  } = {},
): Promise<MerchantListResponse> {
  const query: Record<string, string> = {};
  if (opts.category) query.category = opts.category;
  if (opts.letter) query.letter = opts.letter;
  return apiFetch<MerchantListResponse>('/merchants', {
    method: 'GET',
    query,
    accessToken: null,
    revalidate: 900,
    signal: opts.signal,
    timeoutMs: 5_000,
    maxRetries: 1,
  });
}

/**
 * Typed admin API client — mirrors `/admin/*` endpoints in
 * `../loftly/mvp/artifacts/openapi.yaml` (Agent #14 implementation).
 *
 * All helpers require an admin JWT supplied by the caller; pass `null` to
 * force the upstream 401. No retries on 4xx. Error envelopes are parsed
 * into `LoftlyAPIError` by the shared `apiFetch` wrapper.
 */

import { apiFetch, getApiBase, LoftlyAPIError } from './client';
import type {
  Card,
  CardList,
  Promo,
  Pagination,
  CardStatus,
} from './types';

// ---------- Admin article + promo + mapping shapes ----------

export type ArticleType = 'card_review' | 'guide' | 'news' | 'comparison';
export type ArticleState = 'draft' | 'review' | 'published' | 'archived';

export interface Article {
  id: string;
  slug: string;
  card_id?: string | null;
  article_type: ArticleType;
  title_th: string;
  title_en?: string | null;
  summary_th: string;
  summary_en?: string | null;
  body_th: string;
  body_en?: string | null;
  best_for_tags: string[];
  state: ArticleState;
  policy_version: string;
  published_at?: string | null;
  updated_at: string;
  seo_meta?: Record<string, unknown>;
}

export interface ArticleList {
  data: Article[];
  pagination: Pagination;
}

export interface ArticleUpsert {
  slug?: string;
  card_id?: string | null;
  article_type: ArticleType;
  title_th: string;
  title_en?: string | null;
  summary_th: string;
  summary_en?: string | null;
  body_th: string;
  body_en?: string | null;
  best_for_tags?: string[];
  state: ArticleState;
  seo_meta?: Record<string, unknown>;
}

export interface CardUpsert {
  slug?: string;
  display_name: string;
  bank_slug: string;
  tier?: string | null;
  network: string;
  annual_fee_thb?: number | null;
  annual_fee_waiver?: string | null;
  min_income_thb?: number | null;
  min_age?: number | null;
  earn_currency_code: string;
  earn_rate_local: Record<string, number>;
  earn_rate_foreign?: Record<string, number> | null;
  benefits?: Record<string, unknown>;
  signup_bonus?: {
    bonus_points: number;
    spend_required: number;
    timeframe_days: number;
  } | null;
  description_th?: string | null;
  description_en?: string | null;
  status: CardStatus;
}

export interface PromoUpsert {
  bank_slug: string;
  source_url: string;
  promo_type: Promo['promo_type'];
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
  card_ids?: string[];
  active: boolean;
}

export interface PromoList {
  data: Promo[];
  pagination: Pagination;
}

export interface MappingQueueItem {
  promo_id: string;
  title_th: string;
  bank_slug: string;
  card_types_raw: string[];
  suggested_card_ids: string[];
}

export interface MappingQueue {
  data: MappingQueueItem[];
  total: number;
}

export interface AffiliateStats {
  period_days: number;
  clicks: number;
  conversions: number;
  conversion_rate: number;
  commission_pending_thb: number;
  commission_confirmed_thb: number;
  commission_paid_thb: number;
  by_card: Array<{
    card_slug: string;
    clicks: number;
    conversions: number;
    commission_thb: number;
  }>;
}

// ---------- Helpers ----------

function requireToken(accessToken: string | null | undefined): string {
  if (!accessToken) {
    throw new LoftlyAPIError({
      code: 'auth_required',
      message_en: 'Admin session required',
      message_th: 'ต้องเข้าสู่ระบบผู้ดูแลก่อน',
      status: 401,
    });
  }
  return accessToken;
}

// ---------- Cards ----------

export function listAdminCards(
  accessToken: string | null,
  opts: { status?: CardStatus; signal?: AbortSignal } = {},
): Promise<CardList> {
  return apiFetch<CardList>('/admin/cards', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    query: opts.status ? { status: opts.status } : undefined,
    revalidate: false,
    signal: opts.signal,
  });
}

export function createAdminCard(
  payload: CardUpsert,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Card> {
  return apiFetch<Card>('/admin/cards', {
    method: 'POST',
    body: payload,
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

export function updateAdminCard(
  id: string,
  payload: Partial<CardUpsert>,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Card> {
  return apiFetch<Card>(`/admin/cards/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

// ---------- Articles ----------

export function listAdminArticles(
  accessToken: string | null,
  opts: {
    state?: ArticleState;
    card_id?: string;
    signal?: AbortSignal;
  } = {},
): Promise<ArticleList> {
  return apiFetch<ArticleList>('/admin/articles', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    query: {
      state: opts.state,
      card_id: opts.card_id,
    },
    revalidate: false,
    signal: opts.signal,
  });
}

export function createAdminArticle(
  payload: ArticleUpsert,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Article> {
  return apiFetch<Article>('/admin/articles', {
    method: 'POST',
    body: payload,
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

export function updateAdminArticle(
  id: string,
  payload: Partial<ArticleUpsert>,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Article> {
  return apiFetch<Article>(`/admin/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

// ---------- Stale articles (re-verification) ----------

export interface StaleArticleCard {
  id: string;
  slug: string;
  display_name: string;
}

export interface StaleArticleBank {
  slug: string;
  display_name_en: string;
  display_name_th: string;
}

export interface StaleArticleReviewer {
  actor_id: string;
  actor_email: string;
  reviewed_at: string | null;
}

export interface StaleArticle {
  id: string;
  slug: string;
  title_th: string;
  state: ArticleState;
  updated_at: string | null;
  policy_version: string;
  card: StaleArticleCard | null;
  bank: StaleArticleBank | null;
  last_reviewed_by: StaleArticleReviewer | null;
}

export interface StalePagination {
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface StaleArticleList {
  data: StaleArticle[];
  pagination: StalePagination;
  threshold_days: number;
  cutoff: string;
}

/**
 * List articles whose `updated_at` is older than `days` days, sorted
 * oldest-first (20 per page). Default threshold: 90 days, default state:
 * `published`. `issuer` filters by bank slug.
 */
export function listStaleArticles(
  accessToken: string | null,
  opts: {
    days?: number;
    state?: ArticleState;
    issuer?: string;
    page?: number;
    signal?: AbortSignal;
  } = {},
): Promise<StaleArticleList> {
  return apiFetch<StaleArticleList>('/admin/articles/stale', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    query: {
      days: opts.days,
      state: opts.state,
      issuer: opts.issuer,
      page: opts.page,
    },
    revalidate: false,
    signal: opts.signal,
  });
}

export interface MarkReviewedResponse {
  id: string;
  slug: string;
  state: ArticleState;
  updated_at: string;
}

/** Bump `updated_at = NOW()` and write an `article.reviewed` audit row. */
export function markArticleReviewed(
  id: string,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<MarkReviewedResponse> {
  return apiFetch<MarkReviewedResponse>(
    `/admin/articles/${encodeURIComponent(id)}/mark-reviewed`,
    {
      method: 'POST',
      accessToken: requireToken(accessToken),
      revalidate: false,
      signal: opts.signal,
      maxRetries: 0,
    },
  );
}

// ---------- Promos ----------

export function listAdminPromos(
  accessToken: string | null,
  opts: {
    bank?: string;
    active?: boolean;
    manual_only?: boolean;
    signal?: AbortSignal;
  } = {},
): Promise<PromoList> {
  return apiFetch<PromoList>('/admin/promos', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    query: {
      bank: opts.bank,
      active: opts.active,
      manual_only: opts.manual_only,
    },
    revalidate: false,
    signal: opts.signal,
  });
}

export function createAdminPromo(
  payload: PromoUpsert,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Promo> {
  return apiFetch<Promo>('/admin/promos', {
    method: 'POST',
    body: payload,
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

export function updateAdminPromo(
  id: string,
  payload: Partial<PromoUpsert>,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<Promo> {
  return apiFetch<Promo>(`/admin/promos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    maxRetries: 0,
  });
}

// ---------- Mapping queue ----------

export function listMappingQueue(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<MappingQueue> {
  return apiFetch<MappingQueue>('/admin/mapping-queue', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
  });
}

export function assignMappingQueueItem(
  promoId: string,
  cardIds: string[],
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  return apiFetch<void>(
    `/admin/mapping-queue/${encodeURIComponent(promoId)}/assign`,
    {
      method: 'POST',
      body: { card_ids: cardIds },
      accessToken: requireToken(accessToken),
      revalidate: false,
      signal: opts.signal,
      maxRetries: 0,
    },
  );
}

// ---------- Affiliate stats ----------

export function getAffiliateStats(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<AffiliateStats> {
  return apiFetch<AffiliateStats>('/admin/affiliate/stats', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
  });
}

/**
 * Compose the CSV export URL — browsers must navigate here directly to trigger
 * the download. Caller typically does `window.location.href = buildCsvUrl(token)`.
 * The token is appended as a signed query param because a plain anchor tag
 * cannot add an Authorization header.
 */
export function getAffiliateExportUrl(accessToken: string | null): string {
  const base = getApiBase();
  const url = new URL(`${base}/admin/affiliate/export.csv`);
  if (accessToken) {
    // Backend accepts either Authorization header or ?token=… for downloads.
    url.searchParams.set('token', accessToken);
  }
  return url.toString();
}

/**
 * CSV export URL for the date-range + partner-filtered stats endpoint
 * (`/admin/affiliate/stats.csv` shipped in loftly-api 4d20e0f).
 *
 * `from` / `to` are ISO `YYYY-MM-DD` dates (inclusive); if omitted the backend
 * defaults to the last 30 days. `partnerId` is an optional affiliate network
 * slug — when `undefined` or `'all'` the param is dropped and results cover
 * every partner.
 */
export function getAffiliateStatsCsvUrl(
  accessToken: string | null,
  opts: { from?: string; to?: string; partnerId?: string | null } = {},
): string {
  const base = getApiBase();
  const url = new URL(`${base}/admin/affiliate/stats.csv`);
  if (opts.from) url.searchParams.set('from', opts.from);
  if (opts.to) url.searchParams.set('to', opts.to);
  if (opts.partnerId && opts.partnerId !== 'all') {
    url.searchParams.set('partner_id', opts.partnerId);
  }
  if (accessToken) {
    url.searchParams.set('token', accessToken);
  }
  return url.toString();
}

export interface AffiliatePartner {
  id: string;
  name: string;
}

/**
 * TODO(backend): `/admin/affiliate/partners` is not yet implemented in
 * loftly-api. Until the endpoint lands, callers should fall back to the
 * hardcoded list in `KNOWN_AFFILIATE_PARTNERS`. Keeping the helper here so the
 * swap to the real endpoint is a one-line change.
 */
export const KNOWN_AFFILIATE_PARTNERS: readonly AffiliatePartner[] = [
  { id: 'moneyguru', name: 'MoneyGuru' },
  { id: 'ktc', name: 'KTC' },
  { id: 'uob', name: 'UOB' },
] as const;

export async function listAffiliatePartners(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<AffiliatePartner[]> {
  try {
    const response = await apiFetch<{ data: AffiliatePartner[] }>(
      '/admin/affiliate/partners',
      {
        method: 'GET',
        accessToken: requireToken(accessToken),
        revalidate: false,
        signal: opts.signal,
        maxRetries: 0,
      },
    );
    return response.data;
  } catch (err) {
    if (err instanceof LoftlyAPIError && err.status === 404) {
      // TODO(backend): remove this fallback once the partners endpoint ships.
      return [...KNOWN_AFFILIATE_PARTNERS];
    }
    throw err;
  }
}

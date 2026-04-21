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
  /**
   * ISO timestamp of the last harvester sync for this promo. Drives the
   * "Unresolved > X days" client-side filter. Optional for backward
   * compatibility — older backend revisions omit the field; treat missing
   * values as "unknown age" and surface them in all filter windows.
   *
   * TODO(backend): `GET /v1/admin/mapping-queue` should include
   * `last_synced_at` in each row so the days-unresolved filter works without a
   * second query. Already exists on the `promos` table.
   */
  last_synced_at?: string | null;
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

export interface BulkAssignProgress {
  completed: number;
  total: number;
  failed: Array<{ promo_id: string; message: string }>;
}

/**
 * Assign the same set of `card_ids` to every promo in `promoIds`.
 *
 * TODO(backend): once `POST /v1/admin/mapping-queue/bulk-assign` ships
 * (body: `{ promo_ids, card_ids }`), replace the per-row loop with a single
 * call. The helper's signature is already bulk-shaped so callers won't need to
 * change.
 *
 * Current implementation: sequential per-row `assignMappingQueueItem` calls.
 * Sequential (not parallel) because the per-row endpoint writes to
 * `promo_card_map` with no transactional batching — a burst of concurrent
 * writes would risk lock contention on SQLite during the MVP window. The
 * `onProgress` callback fires after each row so the UI can surface a progress
 * bar.
 */
export async function bulkAssignMappingQueueItems(
  promoIds: string[],
  cardIds: string[],
  accessToken: string | null,
  opts: {
    signal?: AbortSignal;
    onProgress?: (progress: BulkAssignProgress) => void;
  } = {},
): Promise<BulkAssignProgress> {
  const token = requireToken(accessToken);
  const total = promoIds.length;
  const failed: BulkAssignProgress['failed'] = [];
  let completed = 0;

  for (const promoId of promoIds) {
    if (opts.signal?.aborted) break;
    try {
      // Inlined per-row POST — when the backend bulk endpoint lands, swap the
      // entire loop for a single `apiFetch('/admin/mapping-queue/bulk-assign')`.
      // Inlining (rather than calling `assignMappingQueueItem`) keeps the loop
      // easy to mock in tests via the `apiFetch` boundary.
      await apiFetch<void>(
        `/admin/mapping-queue/${encodeURIComponent(promoId)}/assign`,
        {
          method: 'POST',
          body: { card_ids: cardIds },
          accessToken: token,
          revalidate: false,
          signal: opts.signal,
          maxRetries: 0,
        },
      );
    } catch (err) {
      const message =
        err instanceof LoftlyAPIError
          ? err.message_en
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      failed.push({ promo_id: promoId, message });
    }
    completed += 1;
    opts.onProgress?.({ completed, total, failed: [...failed] });
  }

  return { completed, total, failed };
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

// ---------- Analytics (seed-round metrics exporter) ----------

/**
 * Payload returned by `POST /v1/admin/metrics/export` — the seed-round metrics
 * exporter shipped in `loftly-api@d89519c`. Sections follow the backend
 * response shape exactly; everything is optional at the leaf level so the
 * dashboard can degrade gracefully if the exporter hasn't backfilled a metric.
 *
 * `delta_pct` fields are "period-over-period" — current window vs previous
 * window of the same length; negative values mean decline.
 */
export interface MetricsExport {
  as_of: string;
  users: {
    total_registered: number;
    wau: number;
    mau: number;
    retention_12w: number[];
    consent_grant_pct: number;
    total_registered_delta_pct?: number | null;
    wau_delta_pct?: number | null;
    mau_delta_pct?: number | null;
  };
  selector: {
    invocations: number;
    unique_users: number;
    avg_latency_ms: number;
    top1_conversion_rate: number;
    eval_recall: number;
    invocations_delta_pct?: number | null;
    avg_latency_delta_pct?: number | null;
  };
  affiliate: {
    total_commission_thb: number;
    commission_by_month: Array<{
      month: string;
      pending_thb: number;
      confirmed_thb: number;
      paid_thb: number;
    }>;
    top_cards: Array<{
      card_slug: string;
      clicks: number;
      conversions: number;
      commission_thb: number;
    }>;
    total_commission_delta_pct?: number | null;
  };
  content: {
    articles_published: number;
    avg_article_age_days: number;
    schema_validation_rate: number;
    articles_published_delta_pct?: number | null;
  };
  llm_costs: {
    anthropic_spend_thb: number;
    spend_per_mau_thb: number;
    prompt_cache_hit_rate: number;
    haiku_fallback_rate: number;
    anthropic_spend_delta_pct?: number | null;
  };
  system: {
    uptime_pct: number;
    error_rate_5xx: number;
    p95_latency_ms: number;
    uptime_delta_pct?: number | null;
    p95_latency_delta_pct?: number | null;
  };
}

/**
 * Pulls the full seed-round metrics export, POST-ing `{ as_of }` as required by
 * the backend contract. Callers typically pass today's ISO date; the backend
 * normalises to UTC midnight.
 */
export function exportMetrics(
  accessToken: string | null,
  opts: { asOf: string; signal?: AbortSignal },
): Promise<MetricsExport> {
  return apiFetch<MetricsExport>('/admin/metrics/export', {
    method: 'POST',
    body: { as_of: opts.asOf },
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
    // The export is expensive server-side — give it a longer window than the
    // default 5s before the client bails.
    timeoutMs: 15000,
  });
}

// ---------- Data ingestion coverage (admin · W16 catalog viewer) ----------

/**
 * Coverage status for a single bank — drives the coloured badge on
 * `/admin/ingestion`. Backend semantics:
 *
 *   - `full`    — deal harvester is running AND manual catalog is up to date;
 *                 `active_promos_count` ≥ 10 is the target for MVP banks.
 *   - `partial` — one of the two sources is returning data but the other is
 *                 lagging or incomplete.
 *   - `gap`     — neither source has fresh data; the bank needs attention.
 */
export type BankCoverageStatus = 'full' | 'partial' | 'gap';

export interface BankCoverage {
  bank_slug: string;
  bank_name: string;
  deal_harvester_count: number;
  manual_catalog_count: number;
  active_promos_count: number;
  last_synced_at: string | null;
  coverage_status: BankCoverageStatus;
}

export interface IngestionCoverage {
  banks: BankCoverage[];
  unmapped_promos_count: number;
  overall_coverage_pct: number;
}

/**
 * Pulls per-bank ingestion coverage — `deal_harvester_count` +
 * `manual_catalog_count` plus a roll-up `coverage_status`. Powers the founder's
 * W16 "where are my data gaps?" page.
 *
 * TODO(backend): `GET /v1/admin/ingestion/coverage` is not yet implemented on
 * loftly-api — the page falls back to a stub with a visible banner until the
 * endpoint ships.
 */
export function getIngestionCoverage(
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<IngestionCoverage> {
  return apiFetch<IngestionCoverage>('/admin/ingestion/coverage', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    revalidate: false,
    signal: opts.signal,
  });
}

/**
 * Kicks off a manual re-sync of the deal harvester for a single bank. Returns
 * when the backend has accepted the job — the harvester runs async in the
 * background, so the UI optimistically refreshes after a short delay.
 *
 * TODO(backend): `POST /v1/admin/ingestion/{bank_slug}/resync` is not yet
 * implemented on loftly-api — callers should surface the 404 as an inline
 * error in the meantime.
 */
export function resyncBankIngestion(
  bankSlug: string,
  accessToken: string | null,
  opts: { signal?: AbortSignal } = {},
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(
    `/admin/ingestion/${encodeURIComponent(bankSlug)}/resync`,
    {
      method: 'POST',
      accessToken: requireToken(accessToken),
      revalidate: false,
      signal: opts.signal,
      maxRetries: 0,
    },
  );
}

// ---------- Waitlist (admin viewer + CSV export) ----------

/**
 * A single waitlist signup row as returned by `GET /v1/admin/waitlist`
 * (shipped in loftly-api#12). The endpoint paginates via `limit` + `offset` and
 * filters by `source` (`pricing` | `coming-soon`); both are optional.
 *
 * `variant`, `tier`, and `monthly_price_thb` are only populated for rows from
 * the pricing-page capture flow — coming-soon rows leave them null.
 */
export interface WaitlistEntry {
  id: string;
  email: string;
  source: string;
  variant?: string | null;
  tier?: string | null;
  monthly_price_thb?: number | null;
  created_at: string;
}

export interface WaitlistList {
  data: WaitlistEntry[];
  pagination: Pagination;
}

export type WaitlistSource = 'pricing' | 'coming-soon';

/**
 * List waitlist signups (admin-only). Backend supports:
 *   - `source` — optional filter (pricing / coming-soon). Omit for "all".
 *   - `limit`  — page size; backend defaults to 50, caps at 100.
 *   - `offset` — zero-based offset into the ordered-by-created_at-desc set.
 */
export function listWaitlist(
  accessToken: string | null,
  opts: {
    source?: WaitlistSource;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
  } = {},
): Promise<WaitlistList> {
  return apiFetch<WaitlistList>('/admin/waitlist', {
    method: 'GET',
    accessToken: requireToken(accessToken),
    query: {
      source: opts.source,
      limit: opts.limit,
      offset: opts.offset,
    },
    revalidate: false,
    signal: opts.signal,
  });
}

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

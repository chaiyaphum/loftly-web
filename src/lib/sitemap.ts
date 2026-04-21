/**
 * Sitemap helpers — pure data fetching for `src/app/sitemap.ts`.
 *
 * We deliberately keep these thin and side-effect-free so the sitemap route
 * can compose + degrade gracefully when the API is unreachable (see
 * `fetchSitemapPayload` — errors resolve to empty arrays, never throw).
 *
 * Endpoints hit (all public, read-only, revalidate=3600):
 *   - GET /v1/articles?type=card_review&limit=100&state=published
 *   - GET /v1/articles?type=guide&limit=100&state=published
 *   - GET /v1/valuations?limit=50
 *
 * Article + valuation payload shapes mirror `loftly-api` — see
 * `mvp/artifacts/openapi.yaml`. We re-declare the minimal row shape locally
 * rather than importing `Article` from `@/lib/api/admin` because the admin
 * client requires a JWT and the public list payload projects a narrower set.
 *
 * Hard cap: 5,000 entries total across all sections to stay inside the
 * Next.js sitemap route-file limit (if we ever cross that, we must sharded-
 * sitemap — tracked in ROADMAP §SEO).
 */
import { getApiBase } from './api/client';

export const SITEMAP_REVALIDATE_SECONDS = 3600;
export const SITEMAP_MAX_ENTRIES = 5000;

/** Minimal shape projected from `GET /v1/articles` — slug + timestamps. */
export interface SitemapArticleRow {
  slug: string;
  card_slug?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

/** Minimal shape projected from `GET /v1/valuations` — currency code + freshness. */
export interface SitemapValuationRow {
  code: string;
  computed_at?: string | null;
  updated_at?: string | null;
}

export interface SitemapPayload {
  cardReviews: SitemapArticleRow[];
  guides: SitemapArticleRow[];
  valuations: SitemapValuationRow[];
}

interface ListEnvelope<T> {
  data?: T[];
}

interface RawArticle {
  slug?: string;
  card_slug?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

interface RawValuation {
  currency?: { code?: string };
  code?: string;
  computed_at?: string | null;
  updated_at?: string | null;
}

async function fetchList<T>(path: string): Promise<T[]> {
  const base = getApiBase();
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: SITEMAP_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as ListEnvelope<T>;
    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}

function normaliseArticles(rows: RawArticle[]): SitemapArticleRow[] {
  const out: SitemapArticleRow[] = [];
  for (const row of rows) {
    if (!row || typeof row.slug !== 'string' || row.slug.length === 0) continue;
    out.push({
      slug: row.slug,
      card_slug: row.card_slug ?? null,
      published_at: row.published_at ?? null,
      updated_at: row.updated_at ?? null,
    });
  }
  return out;
}

function normaliseValuations(rows: RawValuation[]): SitemapValuationRow[] {
  const out: SitemapValuationRow[] = [];
  for (const row of rows) {
    const code = row?.currency?.code ?? row?.code;
    if (typeof code !== 'string' || code.length === 0) continue;
    out.push({
      code,
      computed_at: row.computed_at ?? null,
      updated_at: row.updated_at ?? null,
    });
  }
  return out;
}

/**
 * Fetch every dynamic-route bucket in parallel. On upstream failure the
 * affected bucket falls back to an empty array — callers (notably
 * `sitemap.ts`) treat the empty state as "static-only mode" and still emit
 * a valid sitemap. See `Promise.allSettled` usage in the route.
 */
export async function fetchSitemapPayload(): Promise<SitemapPayload> {
  const [cardReviews, guides, valuations] = await Promise.all([
    fetchList<RawArticle>(
      '/articles?type=card_review&limit=100&state=published',
    ).then(normaliseArticles),
    fetchList<RawArticle>(
      '/articles?type=guide&limit=100&state=published',
    ).then(normaliseArticles),
    fetchList<RawValuation>('/valuations?limit=50').then(normaliseValuations),
  ]);
  return { cardReviews, guides, valuations };
}

/**
 * Pick the freshest timestamp available for a row — preferring `updated_at`
 * (authoritative for the row) over `published_at` (card_review) over
 * `computed_at` (valuation). Returns a `Date` for Next.js'
 * `MetadataRoute.Sitemap` `lastModified` field.
 */
export function pickLastModified(
  row: { updated_at?: string | null; published_at?: string | null; computed_at?: string | null },
  fallback: Date,
): Date {
  const raw = row.updated_at ?? row.published_at ?? row.computed_at ?? null;
  if (!raw) return fallback;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

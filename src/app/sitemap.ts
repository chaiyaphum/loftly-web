import type { MetadataRoute } from 'next';
import {
  SITEMAP_MAX_ENTRIES,
  fetchSitemapPayload,
  pickLastModified,
} from '@/lib/sitemap';

/**
 * `/sitemap.xml` — Next.js 15 App Router convention (file name `sitemap.ts`
 * exporting a default `MetadataRoute.Sitemap` → served as
 * `/sitemap.xml`).
 *
 * Design choices:
 *   - Static routes are hardcoded here so `/sitemap.xml` is never broken by
 *     an upstream API outage. Dynamic sections fall back to empty arrays
 *     (see `fetchSitemapPayload`) rather than throwing.
 *   - ISR via `revalidate = 3600` — new cards/valuations/guides surface
 *     within an hour without a redeploy.
 *   - Thai is the default locale (no `/th` prefix per
 *     `src/i18n/routing.ts`); English paths mirror under `/en/*` but are
 *     not emitted in this sitemap until we ship hreflang alt links
 *     (tracked in OPERATIONS.md §SEO).
 *   - Cap at 5,000 entries — Next.js' per-file sitemap limit. If we grow
 *     past that we shard via `generateSitemaps` (ROADMAP §SEO).
 *
 * Priority budget (informational; Google ignores absolute values but uses
 * them comparatively within a site):
 *   - 1.0 landing
 *   - 0.8 card reviews (primary SEO surface)
 *   - 0.7 selector + valuation detail pages
 *   - 0.6 guides
 *   - 0.5 valuations index, cards index, pricing
 *   - 0.3 legal pages
 */

// Keep in sync with SITEMAP_REVALIDATE_SECONDS in `@/lib/sitemap` — Next.js
// requires this to be a literal at the top level of the route module.
export const revalidate = 3600;

const DEFAULT_SITE_URL = 'https://loftly.biggo-analytics.dev';

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/$/, '');
}

function buildUrl(base: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

interface StaticRoute {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}

const STATIC_ROUTES: StaticRoute[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/cards', priority: 0.5, changeFrequency: 'daily' },
  { path: '/selector', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/valuations', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
  {
    path: '/legal/affiliate-disclosure',
    priority: 0.3,
    changeFrequency: 'yearly',
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: buildUrl(site, r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const payload = await fetchSitemapPayload();

  const cardEntries: MetadataRoute.Sitemap = payload.cardReviews.map((row) => ({
    url: buildUrl(site, `/cards/${encodeURIComponent(row.card_slug ?? row.slug)}`),
    lastModified: pickLastModified(row, now),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const valuationEntries: MetadataRoute.Sitemap = payload.valuations.map(
    (row) => ({
      url: buildUrl(site, `/valuations/${encodeURIComponent(row.code)}`),
      lastModified: pickLastModified(row, now),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }),
  );

  const guideEntries: MetadataRoute.Sitemap = payload.guides.map((row) => ({
    url: buildUrl(site, `/guides/${encodeURIComponent(row.slug)}`),
    lastModified: pickLastModified(row, now),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const combined = [
    ...staticEntries,
    ...cardEntries,
    ...valuationEntries,
    ...guideEntries,
  ];

  if (combined.length > SITEMAP_MAX_ENTRIES) {
    return combined.slice(0, SITEMAP_MAX_ENTRIES);
  }
  return combined;
}

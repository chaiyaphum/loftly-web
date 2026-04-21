import type { MetadataRoute } from 'next';

/**
 * `/robots.txt` — Next.js 15 App Router convention (file name `robots.ts`
 * exporting a default `MetadataRoute.Robots`).
 *
 * Disallow list rationale:
 *   - `/admin/*`    — editorial back-office; must never be crawled.
 *   - `/account/*`  — user-scoped pages behind auth.
 *   - `/api/*`      — internal endpoints; also blocked by middleware but
 *                     belt-and-braces for indexation signals.
 *   - `/onboarding` — magic-link dashboard; login-only, no SEO value.
 *   - `/invite-required` — soft-launch gate landing, not a canonical page.
 *   - `/selector/results/*` — session-scoped result pages (include a
 *     `session_id`); indexing would surface stale / user-specific URLs.
 *
 * `host` is set to the current staging subdomain — flip to
 * `loftly.co.th` at public launch (see `MANUAL_ITEMS.md` §Launch
 * cutover).
 */

const DEFAULT_SITE_URL = 'https://loftly.biggo-analytics.dev';

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/$/, '');
}

function getHost(): string {
  const site = getSiteUrl();
  try {
    return new URL(site).host;
  } catch {
    return 'loftly.biggo-analytics.dev';
  }
}

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/*',
          '/account/*',
          '/api/*',
          '/onboarding',
          '/invite-required',
          '/selector/results/*',
        ],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: getHost(),
  };
}

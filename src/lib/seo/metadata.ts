import type { Metadata } from 'next';

/**
 * SEO metadata helpers.
 *
 * One source of truth for:
 *   - `metadataBase` (env-driven, matches robots/sitemap)
 *   - Default title template + OG/Twitter card shape
 *   - Hreflang alternates (th default, en mirror under /en/*)
 *   - `robots` policy for surfaces that must not be indexed
 *
 * Consumed by:
 *   - `src/app/layout.tsx` for site-wide defaults
 *   - `src/app/**\/page.tsx` (static + `generateMetadata`) when a page wants
 *     to customise title/description/OG image
 *
 * Environment:
 *   - `NEXT_PUBLIC_SITE_URL` — the canonical origin. Falls back to the
 *     staging subdomain matching `robots.ts` / `sitemap.ts`.
 */

const DEFAULT_SITE_URL = 'https://loftly.biggo-analytics.dev';

export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
).replace(/\/$/, '');

export const SITE_NAME = 'Loftly';
export const SITE_TAGLINE_EN = 'Lift your rewards';
export const SITE_TAGLINE_TH = 'ยกระดับทุกแต้มของคุณ';

/**
 * Default OG image path. `metadataBase` on the root layout makes this a
 * relative URL that Next.js resolves to an absolute URL in <meta> output.
 *
 * The image is a 1200×630 PNG — the canonical OG dimensions endorsed by
 * Facebook, Twitter, LinkedIn, LINE. A minimal placeholder ships under
 * `public/og-default.png`; richer per-card/per-currency images are a
 * Phase 2 follow-up (see DEV_PLAN W13 — "flag as future").
 */
export const DEFAULT_OG_IMAGE = {
  url: '/og-default.png',
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_TAGLINE_EN}`,
};

const DEFAULT_DESCRIPTION =
  'AI-native credit card rewards optimization for Thailand. Find the card that makes every baht count.';

/** Hreflang alternates. Thai lives at `/`, English at `/en/*`. */
export function languageAlternates(pathname: string): Record<string, string> {
  // Normalise so we always pass a leading slash and no trailing slash.
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const trimmed = clean.length > 1 ? clean.replace(/\/$/, '') : clean;
  return {
    'th-TH': `${SITE_URL}${trimmed}`,
    'en-US': `${SITE_URL}/en${trimmed === '/' ? '' : trimmed}`,
    'x-default': `${SITE_URL}${trimmed}`,
  };
}

/**
 * Root-level metadata defaults. Deliberately exported as a plain object so
 * `src/app/layout.tsx` can spread it after setting `metadataBase`.
 */
export const DEFAULT_METADATA: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE_EN}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'th_TH',
    alternateLocale: ['en_US'],
    url: SITE_URL,
    title: `${SITE_NAME} — ${SITE_TAGLINE_EN}`,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE_EN}`,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  alternates: {
    canonical: SITE_URL,
    languages: languageAlternates('/'),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

/** Options for the per-page metadata builder. */
export interface PageMetadataOptions {
  /** Visible title (excluding the `· Loftly` suffix from the root template). */
  title?: string;
  /** Description for `<meta name="description">` + OG/Twitter. */
  description?: string;
  /** Path used to build canonical + hreflang alternates (e.g. `/cards/kbank-the-one`). */
  path?: string;
  /** Override OG image URL. Relative to `metadataBase`; falls back to default. */
  ogImage?: string;
  /** Override OG type (`website` default; `article` for reviews/guides). */
  ogType?: 'website' | 'article';
  /** Mark a page `noindex` — narrow list declared in `NOINDEX_PATHS`. */
  noindex?: boolean;
}

/**
 * Builder for per-page metadata. Returns a `Metadata` object that merges
 * onto the root defaults when Next.js composes <head> output.
 */
export function buildPageMetadata(opts: PageMetadataOptions = {}): Metadata {
  const title = opts.title;
  const description = opts.description ?? DEFAULT_DESCRIPTION;
  const ogImageUrl = opts.ogImage ?? DEFAULT_OG_IMAGE.url;
  const ogType = opts.ogType ?? 'website';

  const meta: Metadata = {
    title,
    description,
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      locale: 'th_TH',
      alternateLocale: ['en_US'],
      title: title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE_EN}`,
      description,
      images: [
        ogImageUrl === DEFAULT_OG_IMAGE.url
          ? DEFAULT_OG_IMAGE
          : { url: ogImageUrl, width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — ${SITE_TAGLINE_EN}`,
      description,
      images: [ogImageUrl],
    },
  };

  if (opts.path) {
    meta.alternates = {
      canonical: `${SITE_URL}${opts.path.startsWith('/') ? opts.path : `/${opts.path}`}`,
      languages: languageAlternates(opts.path),
    };
    if (meta.openGraph) {
      (meta.openGraph as { url?: string }).url = `${SITE_URL}${
        opts.path.startsWith('/') ? opts.path : `/${opts.path}`
      }`;
    }
  }

  if (opts.noindex) {
    meta.robots = {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    };
  }

  return meta;
}

/** Shortcut for pages that should never be indexed per `robots.ts`. */
export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

import createNextIntlPlugin from 'next-intl/plugin';
import createBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Bundle analyzer — only enabled when ANALYZE=true. Writes client.html /
// server.html / edge.html into `.next/analyze/` for inspection.
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages target — use the @cloudflare/next-on-pages adapter at build time
  // (see `npm run pages:build`). Routes running in the Edge runtime must export
  // `export const runtime = 'edge'` explicitly.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Future: add CDN hostnames for card images here
    ],
  },
  poweredByHeader: false,
};

const withIntlApplied = withBundleAnalyzer(withNextIntl(nextConfig));

// Sentry wrapper — only applied when the DSN env var is set. Otherwise we ship
// the vanilla config (avoids upload-source-maps failures on preview builds).
const sentryDsn =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN;

let finalConfig = withIntlApplied;

if (sentryDsn) {
  const { withSentryConfig } = await import('@sentry/nextjs');
  finalConfig = withSentryConfig(withIntlApplied, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  });
}

export default finalConfig;

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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

export default withNextIntl(nextConfig);

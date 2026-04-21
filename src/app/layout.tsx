import type { Metadata } from 'next';
import { Inter, Noto_Sans_Thai_Looped } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { DEFAULT_METADATA, SITE_URL } from '@/lib/seo/metadata';

// Self-hosted via next/font (per UI_WEB.md §i18n spec — no runtime Google Fonts request).
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoThai = Noto_Sans_Thai_Looped({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});

/**
 * Root metadata — shared defaults for every route that doesn't set its
 * own. Per-page `generateMetadata` / `export const metadata` overrides
 * merge shallowly on top of these, so we only declare values that are
 * genuinely site-wide (title template, OG + Twitter card shape, robots
 * policy, hreflang alternates).
 *
 * See `@/lib/seo/metadata` for the builder used by dynamic routes.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...DEFAULT_METADATA,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${notoThai.variable}`}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Noto_Sans_Thai_Looped } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { DEFAULT_METADATA, SITE_URL } from '@/lib/seo/metadata';
import { SiteShell } from '@/components/layout/SiteShell';

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

// JetBrains Mono for THB numeric displays (brief §6 — numeric-hero + numeric-table).
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

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
    <html
      lang={locale}
      className={`${inter.variable} ${notoThai.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-loftly-warm-white font-sans text-loftly-ink antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SiteShell>{children}</SiteShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter, Noto_Sans_Thai_Looped } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

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

export const metadata: Metadata = {
  title: {
    default: 'Loftly — Lift your rewards',
    template: '%s · Loftly',
  },
  description:
    'AI-native credit card rewards optimization for Thailand. Find the card that makes every baht count.',
  metadataBase: new URL('https://loftly.co.th'),
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

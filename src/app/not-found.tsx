import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

/**
 * Root 404 — Thai-primary copy matching BRAND.md §4 voice (direct, warm,
 * specific). Three CTAs cover the three common "lost user" paths: home,
 * card reviews, and the selector. One-screen layout, no scroll on mobile.
 */
export default async function NotFound() {
  const t = await getTranslations('errors.notFound');
  const tSkip = await getTranslations('errors');
  const supportEmail =
    process.env.FOUNDER_NOTIFY_EMAIL || 'support@loftly.co.th';

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        {tSkip('skipToMain')}
      </a>
      <main
        id="main-content"
        className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-6 py-8 text-center"
      >
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-loftly-ink-muted">
          404
        </p>
        <h1 className="text-3xl font-semibold text-loftly-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mt-3 text-base text-loftly-ink-muted">{t('subtitle')}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Button asChild size="lg">
            <Link href="/" aria-label={t('cta_home')}>
              {t('cta_home')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/cards" aria-label={t('cta_cards')}>
              {t('cta_cards')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/selector" aria-label={t('cta_selector')}>
              {t('cta_selector')}
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-xs text-loftly-ink-muted">
          {t('supportText', { email: supportEmail })
            .split(supportEmail)
            .flatMap((chunk, i, arr) =>
              i < arr.length - 1
                ? [
                    chunk,
                    <a
                      key={i}
                      href={`mailto:${supportEmail}`}
                      className="text-loftly-teal underline underline-offset-2 hover:opacity-80"
                    >
                      {supportEmail}
                    </a>,
                  ]
                : [chunk],
            )}
        </p>
      </main>
    </>
  );
}

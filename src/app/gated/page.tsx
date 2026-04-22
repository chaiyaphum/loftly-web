import { getTranslations } from 'next-intl/server';

/**
 * `/gated` — shown when Cloudflare Access blocks the request (401) during soft
 * launch. Cloudflare redirects here after returning 401 at the edge. The page
 * is fully static so it's available even to visitors without a session.
 */
export default async function GatedPage() {
  const t = await getTranslations('gated');

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-5 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-sm text-loftly-ink-muted">{t('body')}</p>
      <a
        href="mailto:hello@loftly.co.th"
        className="w-fit rounded-md bg-loftly-baht px-4 py-2 text-sm font-medium text-white hover:bg-loftly-baht/90"
      >
        {t('contactCta')}
      </a>
    </main>
  );
}

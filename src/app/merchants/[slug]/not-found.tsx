import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

/**
 * `/merchants/[slug]` 404. Triggered when the backend returns 404 for the
 * merchant slug, or when the fetch fails entirely (treated as a hard miss
 * by the server page). Mirrors the style of `src/app/cards/[slug]/not-found.tsx`.
 */
export default async function MerchantNotFound() {
  const t = await getTranslations('merchants');
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-loftly-ink">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-3 text-sm text-loftly-ink-muted">{t('notFoundBody')}</p>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/merchants">{t('notFoundCta')}</Link>
        </Button>
      </div>
    </main>
  );
}

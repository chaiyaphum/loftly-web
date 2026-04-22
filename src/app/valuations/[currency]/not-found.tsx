import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

/**
 * `/valuations/[currency]` 404. Triggered when the currency slug is unknown
 * or the valuation fetch fails entirely. Mirrors
 * `src/app/cards/[slug]/not-found.tsx` for consistency.
 */
export default async function ValuationNotFound() {
  const t = await getTranslations('valuations');
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-loftly-ink">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-3 text-sm text-loftly-ink-muted">{t('notFoundBody')}</p>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/valuations">{t('notFoundCta')}</Link>
        </Button>
      </div>
    </main>
  );
}

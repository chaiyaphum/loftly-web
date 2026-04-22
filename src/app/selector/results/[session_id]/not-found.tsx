import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

/**
 * `/selector/results/[session_id]` 404. Triggered when the session is unknown
 * or can't be loaded at all. The existing `RetryWrapper` inside `page.tsx`
 * handles live 404/410/5xx responses from the selector API — this file only
 * runs when the server component calls `notFound()` from a catch block.
 * Mirrors `src/app/cards/[slug]/not-found.tsx`.
 */
export default async function SelectorResultsNotFound() {
  const t = await getTranslations('selector.results.error');
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-loftly-ink">{t('notFound')}</h1>
      <p className="mt-3 text-sm text-loftly-ink-muted">
        {/* Short supporting copy — keep parallel with other not-found pages. */}
      </p>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/selector">{t('notFoundCta')}</Link>
        </Button>
      </div>
    </main>
  );
}

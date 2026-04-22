import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listCards } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import { CardResultCard } from '@/components/loftly/CardResultCard';
import { Button } from '@/components/ui/button';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { Card as CardT } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'รีวิวบัตรเครดิตไทย',
  description: 'รวมรีวิวและอัตราสะสมแต้มของบัตรเครดิตไทย อัปเดตโดยทีม Loftly',
  path: '/cards',
});

/**
 * Cards catalog index. SSR against `GET /v1/cards` with a short cache window.
 *
 * Error strategy:
 *   - API unreachable → catch the error, log to the server console (Sentry in
 *     Phase 2), render a Thai error card with a retry link.
 *   - Empty list → friendly Thai empty state.
 */
export default async function CardsIndexPage() {
  const t = await getTranslations('cards');

  let cards: CardT[] = [];
  let loadError: string | null = null;
  try {
    const result = await listCards({ limit: 60 });
    cards = result.data ?? [];
  } catch (err) {
    if (err instanceof LoftlyAPIError) {
      console.error('[cards] listCards failed', err.code, err.message_en);
    } else {
      console.error('[cards] listCards unexpected', err);
    }
    loadError = t('loadError');
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('indexTitle')}
        </h1>
        <p className="text-sm text-loftly-ink-muted">{t('indexSubtitle')}</p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-8 rounded-md border border-red-200 bg-loftly-danger/10 p-4 text-sm text-loftly-danger"
        >
          <p className="mb-2">{loadError}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/cards">{t('notFoundBackCta')}</Link>
          </Button>
        </div>
      )}

      {!loadError && cards.length === 0 && (
        <p className="rounded-md bg-loftly-teal-soft/40 p-6 text-center text-sm text-loftly-ink-muted">
          {t('emptyState')}
        </p>
      )}

      {cards.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => (
            <CardResultCard key={card.id} card={card} position={i + 1} />
          ))}
        </div>
      )}

      <p className="mt-10 text-xs text-loftly-ink-muted">{t('disclaimer')}</p>
    </main>
  );
}

import Link from 'next/link';
import type { Article } from '@/lib/api/admin';

/**
 * LatestReviewsGrid — 6 card-review tiles for the landing page.
 *
 * Data shape: `Article` from `/v1/articles?type=card_review&limit=6`. Each
 * tile links to the `/cards/[slug]` review page. When the upstream article
 * is bound to a card (`card_id`), we still link by the card slug because
 * that's where the public review body lives — falling back to the article
 * slug only if `card_slug` is not projected onto the list payload.
 *
 * Kept in `components/homepage/` because it's landing-specific; a richer
 * review tile is `loftly/CardResultCard`. That component expects a full
 * `Card` object (earn_currency, benefits, affiliate CTA…) which the
 * article list payload does not carry, so we render a leaner summary tile
 * here instead of forcing a second round-trip per article.
 */

export interface LatestReviewsArticle
  extends Pick<
    Article,
    'id' | 'slug' | 'title_th' | 'summary_th' | 'published_at'
  > {
  /**
   * Optional projection from the backend — when `card_id` resolves to a
   * known card, the list endpoint may include its public slug so the tile
   * can deep-link into the card review page.
   */
  card_slug?: string | null;
}

export interface LatestReviewsGridProps {
  articles: LatestReviewsArticle[];
  emptyLabel: string;
  browseAllLabel: string;
}

function hrefFor(article: LatestReviewsArticle): string {
  const slug = article.card_slug || article.slug;
  return `/cards/${encodeURIComponent(slug)}`;
}

export function LatestReviewsGrid({
  articles,
  emptyLabel,
  browseAllLabel,
}: LatestReviewsGridProps) {
  if (articles.length === 0) {
    return (
      <div
        data-testid="latest-reviews-empty"
        className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-600"
      >
        <p>{emptyLabel}</p>
        <Link
          href="/cards"
          className="mt-2 inline-block font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {browseAllLabel} →
        </Link>
      </div>
    );
  }

  return (
    <ul
      data-testid="latest-reviews-grid"
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {articles.map((article) => (
        <li key={article.id} className="h-full">
          <Link
            href={hrefFor(article)}
            data-testid="latest-reviews-item"
            className="flex h-full flex-col rounded-md border border-slate-200 bg-white p-4 transition hover:border-slate-400"
          >
            <h3 className="text-base font-semibold text-slate-900">
              {article.title_th}
            </h3>
            {article.summary_th && (
              <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                {article.summary_th}
              </p>
            )}
            {article.published_at && (
              <time
                className="mt-auto pt-3 text-xs text-slate-500"
                dateTime={article.published_at}
              >
                {new Date(article.published_at).toISOString().slice(0, 10)}
              </time>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

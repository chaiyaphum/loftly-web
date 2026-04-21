import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  LatestReviewsGrid,
  type LatestReviewsArticle,
} from './LatestReviewsGrid';

function article(i: number): LatestReviewsArticle {
  return {
    id: `art-${i}`,
    slug: `review-${i}`,
    title_th: `รีวิวบัตรที่ ${i}`,
    summary_th: `สรุปรีวิวที่ ${i}`,
    published_at: `2026-04-${10 + i}T00:00:00Z`,
    card_slug: `kbank-card-${i}`,
  };
}

describe('LatestReviewsGrid', () => {
  it('renders a tile per article and deep-links to /cards/[card_slug]', () => {
    const articles = [article(1), article(2), article(3)];
    const { getByTestId, getAllByTestId } = render(
      <LatestReviewsGrid
        articles={articles}
        emptyLabel="empty"
        browseAllLabel="browse"
      />,
    );
    const grid = getByTestId('latest-reviews-grid');
    expect(grid.querySelectorAll('li').length).toBe(3);
    const items = getAllByTestId('latest-reviews-item');
    expect(items[0]?.getAttribute('href')).toBe('/cards/kbank-card-1');
    expect(items[0]?.textContent).toContain('รีวิวบัตรที่ 1');
  });

  it('falls back to the article slug when card_slug is missing', () => {
    const { getByTestId } = render(
      <LatestReviewsGrid
        articles={[{ ...article(1), card_slug: null }]}
        emptyLabel="empty"
        browseAllLabel="browse"
      />,
    );
    const tile = getByTestId('latest-reviews-item');
    expect(tile.getAttribute('href')).toBe('/cards/review-1');
  });

  it('renders the empty state with the /cards link when there are no articles', () => {
    const { getByTestId, queryByTestId } = render(
      <LatestReviewsGrid
        articles={[]}
        emptyLabel="ไม่มีรีวิว"
        browseAllLabel="ดูทั้งหมด"
      />,
    );
    const empty = getByTestId('latest-reviews-empty');
    expect(empty.textContent).toContain('ไม่มีรีวิว');
    expect(empty.querySelector('a')?.getAttribute('href')).toBe('/cards');
    expect(queryByTestId('latest-reviews-grid')).toBeNull();
  });
});

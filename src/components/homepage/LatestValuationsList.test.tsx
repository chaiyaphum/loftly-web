import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { LatestValuationsList } from './LatestValuationsList';
import type { Valuation } from '@/lib/api/types';

function valuation(code: string, confidence = 0.8): Valuation {
  return {
    currency: {
      code,
      display_name_en: `${code} Rewards`,
      display_name_th: `${code} แต้ม`,
      currency_type: 'airline',
    },
    thb_per_point: 0.9,
    methodology: 'percentile_80',
    percentile: 80,
    sample_size: 30,
    confidence,
    top_redemption_example: null,
    computed_at: '2026-04-20T00:00:00Z',
  };
}

describe('LatestValuationsList', () => {
  it('renders a row per valuation and deep-links to /valuations/[code]', () => {
    const { getByTestId, getAllByTestId } = render(
      <LatestValuationsList
        valuations={[valuation('ROP'), valuation('KF'), valuation('AM')]}
        emptyLabel="empty"
        browseAllLabel="browse"
      />,
    );
    const list = getByTestId('latest-valuations-list');
    expect(list.querySelectorAll('li').length).toBe(3);
    const rows = getAllByTestId('latest-valuations-item');
    expect(rows[0]?.getAttribute('href')).toBe('/valuations/ROP');
    expect(rows[1]?.getAttribute('href')).toBe('/valuations/KF');
  });

  it('renders the empty state with the /cards link when there are no valuations', () => {
    const { getByTestId, queryByTestId } = render(
      <LatestValuationsList
        valuations={[]}
        emptyLabel="ยังไม่มีข้อมูล"
        browseAllLabel="ดูทั้งหมด"
      />,
    );
    const empty = getByTestId('latest-valuations-empty');
    expect(empty.textContent).toContain('ยังไม่มีข้อมูล');
    expect(empty.querySelector('a')?.getAttribute('href')).toBe('/cards');
    expect(queryByTestId('latest-valuations-list')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ValuationBadge } from '@/components/loftly/ValuationBadge';
import type { Currency, Valuation } from '@/lib/api/types';

function valuation(overrides: Partial<Valuation> = {}): Valuation {
  return {
    currency: {
      code: 'ROP',
      display_name_en: 'Royal Orchid Plus',
      display_name_th: 'Royal Orchid Plus',
      currency_type: 'airline',
    },
    thb_per_point: 1.52,
    methodology: 'percentile_80',
    percentile: 80,
    sample_size: 42,
    confidence: 0.8,
    top_redemption_example: null,
    computed_at: '2026-04-20T00:00:00Z',
    ...overrides,
  };
}

describe('ValuationBadge', () => {
  it('renders "1 {CODE} mile = {value} THB" for airline currencies at high confidence', () => {
    const v = valuation();
    const { getByText } = render(
      <ValuationBadge currency={v.currency} valuation={v} />,
    );
    expect(getByText('1 ROP mile = 1.52 THB')).toBeInTheDocument();
  });

  it('renders "1 {CODE} point = {value} THB" for bank currencies', () => {
    const bank: Currency = {
      code: 'K_POINT',
      display_name_en: 'K Point',
      display_name_th: 'K Point',
      currency_type: 'bank_proprietary',
    };
    const v = valuation({ currency: bank, thb_per_point: 0.38, confidence: 0.7 });
    const { getByText } = render(
      <ValuationBadge currency={bank} valuation={v} />,
    );
    expect(getByText('1 K_POINT point = 0.38 THB')).toBeInTheDocument();
  });

  it('prefixes "~" for directional band (0.4 <= confidence < 0.6)', () => {
    const v = valuation({ confidence: 0.5 });
    const { container } = render(
      <ValuationBadge currency={v.currency} valuation={v} />,
    );
    const badge = container.querySelector('[data-confidence-band]');
    expect(badge?.getAttribute('data-confidence-band')).toBe('directional');
    expect(badge?.textContent).toBe('1 ROP mile = ~1.52 THB');
  });

  it('renders a range for low-confidence band (< 0.4) instead of a single value', () => {
    const v = valuation({ thb_per_point: 0.25, confidence: 0.2 });
    const { container } = render(
      <ValuationBadge currency={v.currency} valuation={v} />,
    );
    const badge = container.querySelector('[data-confidence-band]');
    expect(badge?.getAttribute('data-confidence-band')).toBe('range');
    // 0.25 * 0.6 = 0.15, 0.25 * 1.4 = 0.35
    expect(badge?.textContent).toBe('1 ROP mile = ~0.15–0.35 THB');
  });

  it('uses the warn palette for non-exact bands', () => {
    const v = valuation({ confidence: 0.3 });
    const { container } = render(
      <ValuationBadge currency={v.currency} valuation={v} />,
    );
    const badge = container.querySelector('[data-confidence-band]');
    expect(badge?.className).toContain('bg-loftly-amber/15');
  });
});

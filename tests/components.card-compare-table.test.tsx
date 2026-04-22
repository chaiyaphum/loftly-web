import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CardCompareTable } from '@/components/loftly/CardCompareTable';
import thMessages from '../messages/th.json';
import type { Card, CardComparison } from '@/lib/api/types';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-' + (overrides.slug ?? 'x'),
    slug: 'sample-card',
    display_name: 'Sample Card',
    bank: {
      slug: 'samplebank',
      display_name_en: 'SampleBank',
      display_name_th: 'ธนาคารตัวอย่าง',
    },
    tier: 'Platinum',
    network: 'Visa',
    annual_fee_thb: 2000,
    annual_fee_waiver: null,
    min_income_thb: 30000,
    min_age: 20,
    earn_currency: {
      code: 'K_POINT',
      display_name_en: 'K Point',
      display_name_th: 'K Point',
      currency_type: 'bank_proprietary',
    },
    earn_rate_local: {
      dining: 3,
      online: 2,
      grocery: 1,
      travel: 2,
      petrol: 1,
      default: 1,
    },
    earn_rate_foreign: null,
    benefits: {},
    description_th: null,
    description_en: null,
    status: 'active',
    ...overrides,
  };
}

function makeComparison(overrides: Partial<CardComparison> = {}): CardComparison {
  return {
    card: makeCard(),
    transfer_partners: [],
    valuation: null,
    loftly_score: 4.2,
    ...overrides,
  };
}

describe('CardCompareTable', () => {
  it('renders the empty-state message when given fewer than 2 comparisons', () => {
    render(wrap(<CardCompareTable comparisons={[makeComparison()]} />));
    expect(
      screen.getByRole('status').textContent,
    ).toMatch(/เลือกบัตรอย่างน้อย 1 ใบ/);
  });

  it('renders all rows (issuer, fee, category earn rates, score, apply CTA) for a full fixture', () => {
    const comparisons: CardComparison[] = [
      makeComparison({
        card: makeCard({
          id: 'card-a',
          slug: 'a',
          display_name: 'Card A',
          bank: {
            slug: 'banka',
            display_name_en: 'BankA',
            display_name_th: 'ธนาคารเอ',
          },
          tier: 'Signature',
          annual_fee_thb: 1000,
          min_income_thb: 25000,
          earn_rate_local: {
            dining: 5,
            online: 3,
            grocery: 2,
            travel: 4,
            petrol: 1,
            default: 1,
          },
        }),
        transfer_partners: [
          {
            destination_code: 'ROP',
            destination_display_name_en: 'ROP',
            destination_display_name_th: 'ROP',
            ratio_source: 4,
            ratio_destination: 1,
            bonus_percentage: 0,
          },
        ],
        valuation: {
          thb_per_point: 0.38,
          methodology: '80p',
          confidence: 0.8,
          sample_size: 20,
        },
        loftly_score: 4.5,
      }),
      makeComparison({
        card: makeCard({
          id: 'card-b',
          slug: 'b',
          display_name: 'Card B',
          bank: {
            slug: 'bankb',
            display_name_en: 'BankB',
            display_name_th: 'ธนาคารบี',
          },
          tier: null,
          annual_fee_thb: null,
          min_income_thb: null,
          earn_rate_local: {
            dining: 2,
            // intentionally missing online/grocery/travel/petrol — should render '—'
            default: 1,
          },
        }),
        transfer_partners: [],
        valuation: null,
        loftly_score: null,
      }),
    ];

    render(wrap(<CardCompareTable comparisons={comparisons} />));

    // jsdom doesn't compute responsive CSS — both desktop and mobile layouts
    // are in the DOM, so assertions use getAllByText and check count > 0.
    const table = screen.getByTestId('card-compare-table');

    expect(within(table).getAllByText('Card A').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Card B').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('ธนาคารเอ').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('ธนาคารบี').length).toBeGreaterThan(0);

    // Annual fee formatting (฿ glyph + comma separator).
    expect(within(table).getAllByText(/฿1,000/).length).toBeGreaterThan(0);

    // Missing values render as em-dash somewhere in the tree.
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);

    // Category earn rates.
    expect(within(table).getAllByText('5x').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('3x').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('2x').length).toBeGreaterThan(0);

    // Transfer partner (Card A has ROP).
    expect(within(table).getAllByText(/ROP/).length).toBeGreaterThan(0);

    // Valuation row.
    expect(within(table).getAllByText(/0\.38/).length).toBeGreaterThan(0);

    // Loftly score.
    expect(within(table).getAllByText('4.5 / 5').length).toBeGreaterThan(0);

    // Apply CTA per card.
    const applyLinks = within(table).getAllByRole('link', { name: /สมัคร/ });
    expect(applyLinks.length).toBeGreaterThanOrEqual(2);
    expect(applyLinks[0]?.getAttribute('href')).toBe('/apply/card-a');
    expect(applyLinks[0]?.getAttribute('rel')).toContain('sponsored');
  });

  it('renders a 3-column comparison without throwing when one card lacks valuation', () => {
    const comparisons: CardComparison[] = [
      makeComparison({
        card: makeCard({ id: '1', slug: 'one', display_name: 'One' }),
      }),
      makeComparison({
        card: makeCard({ id: '2', slug: 'two', display_name: 'Two' }),
      }),
      makeComparison({
        card: makeCard({ id: '3', slug: 'three', display_name: 'Three' }),
        valuation: null,
        loftly_score: null,
      }),
    ];

    render(wrap(<CardCompareTable comparisons={comparisons} />));
    const table = screen.getByTestId('card-compare-table');
    expect(within(table).getAllByText('One').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Two').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Three').length).toBeGreaterThan(0);
  });
});

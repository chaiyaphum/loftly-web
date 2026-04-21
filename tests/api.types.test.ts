import { describe, expect, it } from 'vitest';
import type {
  Card,
  CardList,
  ConsentState,
  ValuationList,
  ErrorEnvelope,
} from '@/lib/api/types';

/**
 * Golden-sample test: verifies that representative JSON payloads (shaped per
 * `openapi.yaml`) assign cleanly to the hand-coded TypeScript types. If a
 * schema field is renamed upstream, this test catches the drift at compile
 * time via the typed `satisfies` assertions.
 */

describe('api types match openapi.yaml sample payloads', () => {
  it('accepts a CardList payload with one Card', () => {
    const payload = {
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          slug: 'kbank-wisdom',
          display_name: 'KBank WISDOM',
          bank: {
            slug: 'kbank',
            display_name_en: 'KBank',
            display_name_th: 'ธนาคารกสิกรไทย',
          },
          tier: 'Infinite',
          network: 'Visa',
          annual_fee_thb: 5000,
          annual_fee_waiver: 'ฟรีปีแรก',
          min_income_thb: 200000,
          min_age: 20,
          earn_currency: {
            code: 'K_POINT',
            display_name_en: 'K Point',
            display_name_th: 'K Point',
            currency_type: 'bank_proprietary',
          },
          earn_rate_local: { dining: 2.0, online: 1.5, default: 1.0 },
          earn_rate_foreign: { default: 1.0 },
          benefits: { lounge: 'Priority Pass 6/year' },
          signup_bonus: null,
          description_th: null,
          description_en: null,
          status: 'active',
        },
      ],
      pagination: { cursor_next: null, has_more: false, total_estimate: 1 },
    } satisfies CardList;

    const firstCard = payload.data[0] as Card;
    expect(firstCard.slug).toBe('kbank-wisdom');
    expect(firstCard.earn_currency.code).toBe('K_POINT');
  });

  it('accepts a ConsentState payload', () => {
    const payload = {
      policy_version: '1.0.2',
      consents: {
        optimization: true,
        marketing: false,
        analytics: true,
        sharing: false,
      },
    } satisfies ConsentState;
    expect(payload.consents.optimization).toBe(true);
  });

  it('accepts a ValuationList payload', () => {
    const payload = {
      data: [
        {
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
          confidence: 0.82,
          top_redemption_example: 'BKK–NRT Business',
          computed_at: '2026-04-19T00:00:00Z',
        },
      ],
    } satisfies ValuationList;
    expect(payload.data[0]?.currency.currency_type).toBe('airline');
  });

  it('accepts an Error envelope payload', () => {
    const payload = {
      error: {
        code: 'card_not_found',
        message_en: 'Card not found',
        message_th: 'ไม่พบบัตร',
      },
    } satisfies ErrorEnvelope;
    expect(payload.error.code).toBe('card_not_found');
  });
});

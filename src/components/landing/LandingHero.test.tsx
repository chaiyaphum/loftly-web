import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../messages/th.json';

/**
 * LandingHero — A/B test wiring for the `landing_hero_cta` PostHog flag.
 *
 * We mock both:
 *   - `@/lib/posthog` — so `useFeatureFlag` reads a deterministic variant,
 *   - `@/lib/analytics` — so we can assert the exact event payloads fired
 *     without touching PostHog's capture pipeline.
 *
 * The translation dictionary is the real `messages/th.json` shipped with the
 * app; that way the test fails loudly if a `landing.hero.*` key drifts.
 */

const mockGetFeatureFlag = vi.fn<(key: string) => string | boolean | undefined>();
const mockOnFeatureFlags = vi.fn<(cb: () => void) => () => void>();

vi.mock('@/lib/posthog', () => ({
  loadPostHog: vi.fn().mockImplementation(async () => ({
    getFeatureFlag: mockGetFeatureFlag,
    onFeatureFlags: mockOnFeatureFlags,
  })),
  getPostHog: vi.fn().mockImplementation(() => ({
    getFeatureFlag: mockGetFeatureFlag,
    onFeatureFlags: mockOnFeatureFlags,
  })),
}));

const mockTrack = vi.fn();
vi.mock('@/lib/analytics', () => ({
  useTrackEvent: () => mockTrack,
}));

import { LandingHero } from './LandingHero';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('LandingHero', () => {
  beforeEach(() => {
    mockGetFeatureFlag.mockReset();
    mockOnFeatureFlags.mockReset();
    mockOnFeatureFlags.mockImplementation(() => () => {});
    mockTrack.mockReset();
  });

  it('renders the control copy when the flag resolves to "control"', async () => {
    mockGetFeatureFlag.mockReturnValue('control');

    render(wrap(<LandingHero reassurance="Free · 10s" />));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'ยกระดับทุกแต้มบัตรเครดิตของคุณ',
      );
    });
    expect(screen.getByRole('link', { name: /ค้นหาบัตรที่ใช่/ })).toHaveAttribute(
      'href',
      '/selector',
    );
    // The `landing_hero_viewed` event fires on mount with the resolved variant.
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_hero_viewed', {
        variant: 'control',
      }),
    );
  });

  it('renders the benefit-led variant copy + fires variant in events', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_benefit_led');

    render(wrap(<LandingHero reassurance="Free · 10s" />));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'เช็คให้รู้ก่อนรูด',
      );
    });
    expect(
      screen.getByText('AI คำนวณบัตรที่คุ้มที่สุดภายใน 10 วินาที'),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /ลองเลย/ });
    expect(cta).toHaveAttribute('href', '/selector');

    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_hero_viewed', {
        variant: 'variant_benefit_led',
      }),
    );

    // Clicking the CTA fires `landing_hero_cta_clicked` with the same variant.
    fireEvent.click(cta);
    expect(mockTrack).toHaveBeenCalledWith('landing_hero_cta_clicked', {
      variant: 'variant_benefit_led',
    });
  });

  it('renders the urgency variant copy + fires variant in events', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_urgency');

    render(wrap(<LandingHero reassurance="Free · 10s" />));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'เก็บค่าคอมแต่ละเดือนก่อนเสีย',
      );
    });
    expect(
      screen.getByText(
        'คนไทยเสียโอกาส THB 30,000–120,000 ต่อปีจากใช้บัตรผิดใบ',
      ),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /เช็คการใช้จ่ายของคุณ/ });

    fireEvent.click(cta);
    expect(mockTrack).toHaveBeenCalledWith('landing_hero_cta_clicked', {
      variant: 'variant_urgency',
    });
  });

  it('falls back to control when PostHog returns an unknown variant string', async () => {
    mockGetFeatureFlag.mockReturnValue('something_weird');

    render(wrap(<LandingHero reassurance="Free · 10s" />));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'ยกระดับทุกแต้มบัตรเครดิตของคุณ',
      );
    });
    // Even under an unexpected server value, the emitted variant is the
    // control bucket — keeps dashboards clean.
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_hero_viewed', {
        variant: 'control',
      }),
    );
  });
});

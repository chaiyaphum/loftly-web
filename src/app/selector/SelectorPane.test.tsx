/**
 * Tests for the Selector pane tab switcher (W19 DEV_PLAN).
 *
 * The plan asks us NOT to flake on the feature flag — so we stub
 * `useFeatureFlag` to return `true` in the NLU test and `false` in the
 * default-render test. The shared PostHog + analytics singletons are also
 * stubbed so the pane renders synchronously without analytics consent.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../messages/th.json';

const mockUseFeatureFlag = vi.fn();

vi.mock('@/lib/feature-flags', () => ({
  useFeatureFlag: (key: string, defaultValue: unknown) =>
    mockUseFeatureFlag(key, defaultValue),
}));

vi.mock('@/lib/analytics', () => ({
  useTrackEvent: () => vi.fn(),
}));

// Keep the real router mock light — none of these tests submit.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/selector',
  useSearchParams: () => new URLSearchParams(),
}));

import { SelectorPane } from './SelectorPane';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('SelectorPane', () => {
  it('hides the NLU tab when typhoon_nlu_spend is OFF (default)', () => {
    mockUseFeatureFlag.mockImplementation(
      (_key: string, defaultValue: unknown) => defaultValue,
    );

    render(wrap(<SelectorPane />));

    expect(screen.queryByRole('tab', { name: /อธิบายเป็นคำพูด/ })).toBeNull();
    // The structured form's monthly-spend label is always there.
    expect(screen.getByLabelText(/ใช้จ่ายเฉลี่ยต่อเดือน/)).toBeInTheDocument();
  });

  it('shows the NLU tab when typhoon_nlu_spend resolves to true', () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'typhoon_nlu_spend' ? true : false,
    );

    render(wrap(<SelectorPane />));

    expect(
      screen.getByRole('tab', { name: /อธิบายเป็นคำพูด/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /กรอกแบบฟอร์ม/ }),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  act,
  render,
  renderHook,
  waitFor,
  screen,
} from '@testing-library/react';

// posthog-js is heavy + browser-only. Mock its surface so we can drive
// `getFeatureFlag` + `onFeatureFlags` deterministically.
const mockGetFeatureFlag = vi.fn<(key: string) => string | boolean | undefined>();
const mockOnFeatureFlags = vi.fn<(cb: () => void) => () => void>();

// Mock the shared PostHog singleton module (`@/lib/posthog`). The feature-flags
// wrapper MUST NOT call `posthog.init` itself — we verify that by not exporting
// one here.
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

import { useFeatureFlag, FeatureFlagGate } from './feature-flags';

describe('useFeatureFlag', () => {
  beforeEach(() => {
    mockGetFeatureFlag.mockReset();
    mockOnFeatureFlags.mockReset();
    mockOnFeatureFlags.mockImplementation(() => () => {});
  });

  it('upgrades from the default to the resolved PostHog variant', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a');

    const { result } = renderHook(() =>
      useFeatureFlag<string>('selector_cta_copy', 'control'),
    );

    // After the effect runs + PostHog resolves, the hook upgrades.
    await waitFor(() => expect(result.current).toBe('variant_a'));
  });

  it('returns the default when PostHog has no value for the flag', async () => {
    mockGetFeatureFlag.mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useFeatureFlag<string>('missing_flag', 'control'),
    );

    await waitFor(() => expect(mockGetFeatureFlag).toHaveBeenCalled());
    expect(result.current).toBe('control');
  });

  it('returns the default when PostHog returns a type mismatch', async () => {
    // Caller asks for a boolean flag, PostHog sends back a string — fall back.
    mockGetFeatureFlag.mockReturnValue('some_variant');

    const { result } = renderHook(() =>
      useFeatureFlag<boolean>('selector_streaming', false),
    );

    await waitFor(() => expect(mockGetFeatureFlag).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('re-reads via onFeatureFlags when flags refresh', async () => {
    let storedCallback: (() => void) | null = null;
    mockOnFeatureFlags.mockImplementation((cb) => {
      storedCallback = cb;
      return () => {};
    });
    // First read: control. After onFeatureFlags fires, second read: variant_a.
    mockGetFeatureFlag
      .mockReturnValueOnce('control')
      .mockReturnValueOnce('variant_a');

    const { result } = renderHook(() =>
      useFeatureFlag<string>('selector_cta_copy', 'control'),
    );

    await waitFor(() => expect(mockOnFeatureFlags).toHaveBeenCalled());
    // Trigger the network-resolved refresh.
    act(() => {
      storedCallback?.();
    });

    await waitFor(() => expect(result.current).toBe('variant_a'));
  });
});

describe('FeatureFlagGate', () => {
  beforeEach(() => {
    mockGetFeatureFlag.mockReset();
    mockOnFeatureFlags.mockReset();
    mockOnFeatureFlags.mockImplementation(() => () => {});
  });

  it('renders children when the flag matches', async () => {
    mockGetFeatureFlag.mockReturnValue('variant_a');

    render(
      <FeatureFlagGate
        flag="selector_cta_copy"
        match="variant_a"
        fallback={<span>control-cta</span>}
      >
        <span>variant-cta</span>
      </FeatureFlagGate>,
    );

    await waitFor(() =>
      expect(screen.getByText('variant-cta')).toBeInTheDocument(),
    );
  });

  it('renders the fallback when the flag does not match', async () => {
    mockGetFeatureFlag.mockReturnValue('control');

    render(
      <FeatureFlagGate
        flag="selector_cta_copy"
        match="variant_a"
        fallback={<span>control-cta</span>}
      >
        <span>variant-cta</span>
      </FeatureFlagGate>,
    );

    await waitFor(() =>
      expect(screen.getByText('control-cta')).toBeInTheDocument(),
    );
  });
});

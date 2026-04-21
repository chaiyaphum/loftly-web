import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock `@/lib/posthog` so we can verify call-through behaviour in isolation.
vi.mock('@/lib/posthog', () => ({
  capture: vi.fn(),
  loadPostHog: vi.fn().mockResolvedValue(null),
  optIn: vi.fn(),
  optOut: vi.fn(),
}));

import { useAnalyticsConsent, useTrackEvent } from '@/lib/analytics';
import { capture, optIn, optOut } from '@/lib/posthog';

function setConsentCookie(flags: Record<string, boolean>) {
  document.cookie = `loftly_consent=${encodeURIComponent(
    JSON.stringify(flags),
  )}; path=/`;
}

describe('analytics consent gating', () => {
  beforeEach(() => {
    document.cookie = 'loftly_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when analytics consent cookie is absent', () => {
    const { result } = renderHook(() => useAnalyticsConsent());
    expect(result.current).toBe(false);
    expect(optOut).toHaveBeenCalled();
  });

  it('returns true when analytics is granted', () => {
    setConsentCookie({
      optimization: true,
      analytics: true,
      marketing: false,
      sharing: false,
    });
    const { result } = renderHook(() => useAnalyticsConsent());
    expect(result.current).toBe(true);
    expect(optIn).toHaveBeenCalled();
  });

  it('useTrackEvent drops the event when consent is absent', () => {
    const { result } = renderHook(() => useTrackEvent());
    act(() => result.current('selector_submitted', { foo: 1 }));
    expect(capture).not.toHaveBeenCalled();
  });

  it('useTrackEvent forwards to posthog when consent granted', () => {
    setConsentCookie({
      optimization: true,
      analytics: true,
      marketing: false,
      sharing: false,
    });
    const { result } = renderHook(() => useTrackEvent());
    act(() => result.current('selector_submitted', { foo: 1 }));
    expect(capture).toHaveBeenCalledWith('selector_submitted', { foo: 1 });
  });
});

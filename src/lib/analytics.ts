'use client';

/**
 * Consent-gated analytics for the client.
 *
 * Spec refs:
 *   - SPEC.md instrumentation sections (event names)
 *   - PDPA: analytics events MUST NOT fire before the user grants `analytics`
 *     consent. We read the consent state from a non-httpOnly cookie set by the
 *     consent flow (`loftly_consent` JSON with the 4 purpose booleans).
 *
 * Usage:
 *   const track = useTrackEvent();
 *   track('selector_submitted', { monthly_spend_thb: 30000 });
 */

import * as React from 'react';
import {
  capture as phCapture,
  loadPostHog,
  optIn,
  optOut,
} from './posthog';

const CONSENT_COOKIE = 'loftly_consent';

export interface ConsentFlags {
  optimization: boolean;
  marketing: boolean;
  analytics: boolean;
  sharing: boolean;
}

function readConsentCookie(): ConsentFlags {
  if (typeof document === 'undefined') {
    return {
      optimization: false,
      marketing: false,
      analytics: false,
      sharing: false,
    };
  }
  const cookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!cookie) {
    return {
      optimization: false,
      marketing: false,
      analytics: false,
      sharing: false,
    };
  }
  try {
    const raw = decodeURIComponent(cookie.split('=')[1] ?? '');
    const parsed = JSON.parse(raw);
    return {
      optimization: Boolean(parsed.optimization),
      marketing: Boolean(parsed.marketing),
      analytics: Boolean(parsed.analytics),
      sharing: Boolean(parsed.sharing),
    };
  } catch {
    return {
      optimization: false,
      marketing: false,
      analytics: false,
      sharing: false,
    };
  }
}

export function useAnalyticsConsent(): boolean {
  const [granted, setGranted] = React.useState<boolean>(
    () => readConsentCookie().analytics,
  );

  React.useEffect(() => {
    // Re-check on mount (cookie may have been updated on consent screen).
    setGranted(readConsentCookie().analytics);

    // Initialise PostHog lazily so even if consent flips on later, we're ready.
    void loadPostHog();
  }, []);

  React.useEffect(() => {
    if (granted) {
      void optIn();
    } else {
      void optOut();
    }
  }, [granted]);

  return granted;
}

export type LoftlyEventName =
  | 'landing_viewed'
  | 'selector_started'
  | 'selector_submitted'
  | 'selector_results_rendered'
  | 'selector_email_capture_shown'
  | 'selector_email_captured'
  | 'card_review_viewed'
  | 'affiliate_click_fired'
  | 'consent_updated'
  | 'onboarding_completed';

/**
 * Returns a typed tracking function that's safe to call even without consent
 * (it silently drops the event when consent is absent).
 */
export function useTrackEvent(): (
  event: LoftlyEventName,
  props?: Record<string, unknown>,
) => void {
  const granted = useAnalyticsConsent();
  return React.useCallback(
    (event, props) => {
      if (!granted) return;
      void phCapture(event, props);
    },
    [granted],
  );
}

/**
 * PostHog client wrapper.
 *
 * - Init is gated on `NEXT_PUBLIC_POSTHOG_KEY`; when unset, every helper is a
 *   no-op so the UI builds without analytics creds (per DEPLOYMENT.md).
 * - `capture()` is further gated on the `analytics` PDPA consent — callers
 *   should rely on `useAnalyticsConsent()` / `useTrackEvent()` rather than
 *   importing `posthog-js` directly.
 * - SSR-safe: all calls check `typeof window !== 'undefined'`.
 */

import type { PostHog } from 'posthog-js';

let instance: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

export async function loadPostHog(): Promise<PostHog | null> {
  if (typeof window === 'undefined') return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const mod = await import('posthog-js');
    const ph = mod.default;
    ph.init(key, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      // We gate capture manually via consent; never surface before opt-in.
      loaded: (phClient) => {
        // Default opt_out — identify() will reverse once consent is granted.
        phClient.opt_out_capturing();
      },
    });
    instance = ph;
    return ph;
  })();
  return initPromise;
}

export function getPostHog(): PostHog | null {
  return instance;
}

export async function capture(
  event: string,
  properties?: Record<string, unknown>,
) {
  const ph = instance ?? (await loadPostHog());
  if (!ph) return;
  ph.capture(event, properties);
}

export async function identifyUser(
  userId: string,
  properties?: Record<string, unknown>,
) {
  const ph = instance ?? (await loadPostHog());
  if (!ph) return;
  ph.identify(userId, properties);
}

export async function optIn() {
  const ph = instance ?? (await loadPostHog());
  if (!ph) return;
  ph.opt_in_capturing();
}

export async function optOut() {
  const ph = instance ?? (await loadPostHog());
  if (!ph) return;
  ph.opt_out_capturing();
}

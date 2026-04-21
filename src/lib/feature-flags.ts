'use client';

/**
 * Client-side feature flags — thin wrapper around the posthog-js SDK.
 *
 * Design rules (extend, don't rewrite):
 *   - Reuses the existing PostHog singleton from `@/lib/posthog`. Do NOT
 *     re-initialise posthog — `loadPostHog()` handles gating on
 *     `NEXT_PUBLIC_POSTHOG_KEY` and on PDPA analytics consent.
 *   - When PostHog is unavailable (no key, consent denied, SSR), every helper
 *     falls back to the caller-supplied default. The UI must look identical
 *     to the "control" path in that mode.
 *   - All flags evaluated here MUST also appear in the server-side
 *     `KNOWN_FLAGS` registry (loftly-api/src/loftly/api/routes/admin_flags.py)
 *     so ops has a single inventory.
 *
 * Public surface:
 *   - `useFeatureFlag(key, defaultValue)` — React hook, re-renders when the
 *     flag first resolves.
 *   - `FeatureFlagGate` — conditional render based on a single flag value.
 */

import * as React from 'react';
import { getPostHog, loadPostHog } from './posthog';

type FlagValue = string | boolean;

/**
 * Read a feature flag. Returns `defaultValue` until PostHog has loaded +
 * evaluated the flag. Safe to call during SSR — the hook starts with the
 * default and upgrades on mount.
 */
export function useFeatureFlag<T extends FlagValue>(
  key: string,
  defaultValue: T,
): T {
  const [value, setValue] = React.useState<T>(defaultValue);

  React.useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // Try the already-initialised client first to avoid re-import churn.
      const existing = getPostHog();
      const ph = existing ?? (await loadPostHog());
      if (cancelled || !ph) return;

      const read = () => {
        const raw = ph.getFeatureFlag(key);
        if (raw === undefined || raw === null) return defaultValue;
        // posthog-js types: string | boolean. Narrow to T when the shape
        // matches the caller's default; otherwise fall back safely.
        if (typeof raw === typeof defaultValue) {
          return raw as T;
        }
        return defaultValue;
      };

      setValue(read());

      // `onFeatureFlags` fires once the flag set is loaded from the network
      // (can be after first render). Re-read so the hook upgrades past the
      // initial default-value snapshot.
      const dispose = ph.onFeatureFlags(() => {
        if (!cancelled) setValue(read());
      });
      return dispose;
    }

    const disposePromise = resolve();
    return () => {
      cancelled = true;
      void disposePromise.then((dispose) => {
        if (typeof dispose === 'function') dispose();
      });
    };
  }, [key, defaultValue]);

  return value;
}

export interface FeatureFlagGateProps {
  flag: string;
  /** Render only when the flag resolves to this value. */
  match: string | boolean;
  /** Optional fallback shown while the flag !== match (including during loading). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditional gate for a single flag value.
 *
 * Example — show the variant CTA only when the flag lands on `variant_a`:
 *   <FeatureFlagGate flag="selector_cta_copy" match="variant_a" fallback={<ControlCTA />}>
 *     <VariantCTA />
 *   </FeatureFlagGate>
 */
export function FeatureFlagGate({
  flag,
  match,
  fallback = null,
  children,
}: FeatureFlagGateProps): React.ReactElement {
  const defaultValue: string | boolean =
    typeof match === 'boolean' ? false : '';
  const value = useFeatureFlag<string | boolean>(flag, defaultValue);
  // React.createElement keeps this file JSX-free so callers can import it
  // from `.ts` files without a compiler step.
  return React.createElement(
    React.Fragment,
    null,
    value === match ? children : fallback,
  );
}

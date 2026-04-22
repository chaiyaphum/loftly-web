'use client';

/**
 * POST_V1 §3 — returning-user landing variant switcher (client-hydrated).
 *
 * Rendering contract:
 *   - SSR → returns the caller-supplied `defaultHero` unchanged. This is what
 *     Googlebot + static ISR sees, so no duplicate-content / cloaking risk.
 *   - Client mount → reads the `loftly_selector_session` cookie written by the
 *     Selector results page (see `src/lib/selector-session-cookie.ts`) and,
 *     when the `post_v1_returning_landing` PostHog flag is ON, calls
 *     `GET /v1/selector/recent` to decide which variant to paint:
 *
 *       • no cookie                       → defaultHero (FRESH visitor)
 *       • flag OFF                        → defaultHero
 *       • cookie + `expired: false`       → <PersonalizedHero> replaces default
 *       • cookie + `expired: true`        → defaultHero + <ExpiredBanner> below
 *       • API / network error             → defaultHero (best-effort silent)
 *
 * Analytics:
 *   - `landing_returning_user_shown` fires once per mount with `{variant, hours_since_last_session}`.
 *   - `landing_returning_cta_clicked` fires on each CTA with `{cta, variant}`.
 *   Both are Analytics-consent gated via `useTrackEvent` — when consent is
 *   absent the events drop silently (UI still renders).
 *
 * Failure modes are deliberately silent: personalization is a delight layer,
 * not a core flow. If anything misbehaves, the user sees the stock hero.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useFeatureFlag } from '@/lib/feature-flags';
import { useTrackEvent } from '@/lib/analytics';
import { readSelectorSessionCookie } from '@/lib/selector-session-cookie';
import {
  archiveSelectorSession,
  getRecentSelectorSession,
  type RecentSessionResponse,
} from '@/lib/api/selector';

type Variant = 'personalized' | 'expired' | 'none';

type HydrationState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'expired'; sessionId: string; hours: number | null }
  | {
      kind: 'personalized';
      sessionId: string;
      data: RecentSessionResponse;
      hours: number | null;
    };

export interface LandingHeroSwitcherProps {
  /** The SSR-rendered hero to use as both SSR output and fallback. */
  defaultHero: React.ReactNode;
}

export function LandingHeroSwitcher({
  defaultHero,
}: LandingHeroSwitcherProps) {
  const enabled = useFeatureFlag<boolean>('post_v1_returning_landing', false);
  const [state, setState] = React.useState<HydrationState>({ kind: 'loading' });
  const track = useTrackEvent();
  // `landing_returning_user_shown` must fire at most once per *resolved*
  // variant. We key the ref on the variant name so that the initial
  // flag-loading transition from `none` → `personalized|expired` still
  // captures the correct bucket once PostHog finally responds.
  const trackedVariant = React.useRef<Variant | null>(null);

  React.useEffect(() => {
    // Flag OFF → short-circuit. Keep SSR hero.
    if (!enabled) {
      setState({ kind: 'none' });
      return;
    }

    const cookie = readSelectorSessionCookie();
    if (!cookie) {
      setState({ kind: 'none' });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await getRecentSelectorSession(cookie.session_id);
        if (cancelled) return;
        if (data.expired || !data.card_name) {
          setState({
            kind: 'expired',
            sessionId: cookie.session_id,
            hours: data.hours_since_last_session,
          });
        } else {
          setState({
            kind: 'personalized',
            sessionId: cookie.session_id,
            data,
            hours: data.hours_since_last_session,
          });
        }
      } catch {
        // Best-effort: on any error, fall back to default hero silently.
        if (!cancelled) setState({ kind: 'none' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Fire `landing_returning_user_shown` as soon as the variant is known.
  // Gate on variant identity so that an early `none` (flag still loading)
  // can upgrade to `personalized|expired` after PostHog + Redis resolve.
  React.useEffect(() => {
    if (state.kind === 'loading') return;
    const variant: Variant =
      state.kind === 'personalized'
        ? 'personalized'
        : state.kind === 'expired'
          ? 'expired'
          : 'none';
    if (trackedVariant.current === variant) return;
    trackedVariant.current = variant;
    const hours =
      state.kind === 'personalized' || state.kind === 'expired'
        ? state.hours
        : null;
    track('landing_returning_user_shown', {
      variant,
      hours_since_last_session: hours,
    });
  }, [state, track]);

  if (state.kind === 'loading' || state.kind === 'none') {
    return <>{defaultHero}</>;
  }

  if (state.kind === 'expired') {
    return (
      <>
        {defaultHero}
        <ExpiredBanner sessionId={state.sessionId} />
      </>
    );
  }

  return <PersonalizedHero sessionId={state.sessionId} data={state.data} />;
}

// ---------- PERSONALIZED variant ----------

function PersonalizedHero({
  sessionId,
  data,
}: {
  sessionId: string;
  data: RecentSessionResponse;
}) {
  const t = useTranslations('landing.returning.personalized');
  const tConfirm = useTranslations('landing.returning.restartConfirm');
  const track = useTrackEvent();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const cardName = data.card_name ?? '';
  const resultsHref = `/selector/results/${encodeURIComponent(sessionId)}`;

  const onViewResults = React.useCallback(() => {
    track('landing_returning_cta_clicked', {
      cta: 'view_results',
      variant: 'personalized',
    });
  }, [track]);

  const onRestartClick = React.useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const onConfirmRestart = React.useCallback(async () => {
    track('landing_returning_cta_clicked', {
      cta: 'restart_selector',
      variant: 'personalized',
    });
    try {
      await archiveSelectorSession(sessionId);
    } catch {
      // Archive best-effort — proceed to `/selector` regardless so the user
      // is never stranded on the landing page due to a backend blip.
    }
    router.push('/selector');
  }, [router, sessionId, track]);

  return (
    <section
      className="flex flex-col gap-6"
      data-testid="returning-hero-personalized"
      data-variant="personalized"
    >
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {t('title', { cardName })}
      </h1>
      <p className="text-lg text-slate-600">{t('subtitle')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href={resultsHref} onClick={onViewResults}>
            {t('viewResults')}
          </Link>
        </Button>
        <Button variant="outline" size="lg" onClick={onRestartClick}>
          {t('restartSelector')}
        </Button>
      </div>
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restart-confirm-title"
          data-testid="restart-confirm"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2
              id="restart-confirm-title"
              className="text-xl font-semibold text-slate-900"
            >
              {tConfirm('title')}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{tConfirm('body')}</p>
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                {tConfirm('no')}
              </Button>
              <Button size="sm" onClick={onConfirmRestart}>
                {tConfirm('yes')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---------- EXPIRED variant (banner below default hero) ----------

function ExpiredBanner({ sessionId }: { sessionId: string }) {
  const t = useTranslations('landing.returning.expired');
  const track = useTrackEvent();

  const onRestart = React.useCallback(() => {
    track('landing_returning_cta_clicked', {
      cta: 'restart_selector',
      variant: 'expired',
    });
    // Archive the stale session id so follow-up requests stop hitting it,
    // but don't block navigation on its result. Fire-and-forget.
    void archiveSelectorSession(sessionId).catch(() => {});
  }, [sessionId, track]);

  return (
    <aside
      data-testid="returning-hero-expired"
      data-variant="expired"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
    >
      <span>{t('banner')}</span>
      <Link
        href="/selector"
        onClick={onRestart}
        className="font-medium text-loftly-teal hover:underline"
      >
        {t('cta')}
      </Link>
    </aside>
  );
}

import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getApiBase } from '@/lib/api/client';

/**
 * LivePromoStrip — slim freshness strip above the landing hero.
 *
 * POSITIONING_SHIFT §15.5: makes "live Thai promo intelligence" the
 * dominant narrative above the fold. SSR-rendered with ISR so it feels
 * live without hammering the API on every request.
 *
 * Data: best-effort fetch of (count, bank_count, last_synced_at). On
 * any failure (network, 5xx, empty), the component renders NOTHING —
 * liveness claims collapse gracefully rather than showing a skeleton
 * or error bar (which would undermine the narrative the strip is
 * trying to establish).
 *
 * Freshness states drive the leading dot color:
 *   < 1h         → emerald pulse
 *   1h  – 24h    → emerald static
 *   24h – 72h    → amber
 *   > 72h        → hidden entirely (stale ≠ live)
 */

type LiveSnapshot = {
  active_promos: number;
  banks: number;
  merchants?: number;
  last_synced_at: string; // ISO
};

const REVALIDATE_SECONDS = 300;

async function fetchLiveSnapshot(): Promise<LiveSnapshot | null> {
  const base = getApiBase();
  // The count endpoint isn't wired yet server-side; the regular /promos
  // endpoint can supply the numbers via a small limit + pagination meta
  // in the interim. If the response shape is missing, we return null
  // and the component renders nothing.
  const url = `${base}/promos?active=true&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      meta?: {
        total?: number;
        banks?: number;
        merchants?: number;
        last_synced_at?: string;
      };
    };
    const meta = body.meta;
    if (!meta || typeof meta.total !== 'number' || !meta.last_synced_at) {
      return null;
    }
    return {
      active_promos: meta.total,
      banks: meta.banks ?? 3,
      merchants: meta.merchants,
      last_synced_at: meta.last_synced_at,
    };
  } catch {
    return null;
  }
}

function freshnessState(
  lastSyncedAt: string,
): 'fresh' | 'recent' | 'aging' | 'stale' {
  const synced = new Date(lastSyncedAt).getTime();
  const age = Date.now() - synced;
  const hr = age / (1000 * 60 * 60);
  if (hr < 1) return 'fresh';
  if (hr < 24) return 'recent';
  if (hr < 72) return 'aging';
  return 'stale';
}

function relativeAge(lastSyncedAt: string, locale: string): string {
  const synced = new Date(lastSyncedAt).getTime();
  const mins = Math.max(1, Math.floor((Date.now() - synced) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale === 'th' ? 'th' : 'en', {
    numeric: 'always',
    style: 'short',
  });
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.floor(hrs / 24);
  return rtf.format(-days, 'day');
}

export async function LivePromoStrip(): Promise<React.ReactElement | null> {
  const snap = await fetchLiveSnapshot();
  if (!snap) return null;

  const state = freshnessState(snap.last_synced_at);
  if (state === 'stale') return null; // stale ≠ live — hide rather than lie

  const [t, locale] = await Promise.all([
    getTranslations('landing.liveStrip'),
    getLocale(),
  ]);

  const dotClass =
    state === 'fresh'
      ? 'bg-emerald-500 animate-pulse'
      : state === 'recent'
        ? 'bg-emerald-500'
        : 'bg-amber-500';

  return (
    <Link
      href="/merchants"
      className="group block w-full border-b border-emerald-200 bg-emerald-50/60 text-sm"
      aria-label={t('ariaLabel')}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-6 py-2">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700">
          <span
            className={`h-2 w-2 rounded-full ${dotClass}`}
            aria-hidden="true"
          />
          <span className="font-medium">
            {t('liveWith', { count: snap.active_promos })}
          </span>
          <span className="text-slate-400">·</span>
          <span>{t('banks', { count: snap.banks })}</span>
          {snap.merchants ? (
            <>
              <span className="text-slate-400">·</span>
              <span>{t('merchants', { count: snap.merchants })}</span>
            </>
          ) : null}
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            {t('updated', { ago: relativeAge(snap.last_synced_at, locale) })}
          </span>
        </span>
        <span className="hidden text-slate-500 group-hover:text-slate-700 sm:inline">
          {t('cta')}
        </span>
      </div>
    </Link>
  );
}

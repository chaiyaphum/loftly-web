import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getApiBase } from '@/lib/api/client';
import { cn } from '@/lib/utils';

/**
 * LivePromoStrip — slim freshness strip above the landing hero.
 *
 * Brief §15.5 — 4-state freshness drives the leading dot:
 *   < 1h         → loftly-success + pulse animation
 *   1h  – 24h    → loftly-ink-muted static
 *   24h – 72h    → loftly-amber
 *   > 72h        → hidden entirely (stale ≠ live)
 *
 * Returns null on any fetch failure so the landing page reads fine
 * without visual noise when the liveness story fails.
 */

type LiveSnapshot = {
  active_promos: number;
  banks: number;
  merchants?: number;
  last_synced_at: string;
};

const REVALIDATE_SECONDS = 300;

async function fetchLiveSnapshot(): Promise<LiveSnapshot | null> {
  const base = getApiBase();
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
  const hr = (Date.now() - synced) / (1000 * 60 * 60);
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

const DOT_COLOR: Record<'fresh' | 'recent' | 'aging', string> = {
  fresh: 'bg-loftly-success animate-loftly-pulse-dot',
  recent: 'bg-loftly-ink-muted',
  aging: 'bg-loftly-amber',
};

export async function LivePromoStrip(): Promise<React.ReactElement | null> {
  const snap = await fetchLiveSnapshot();
  if (!snap) return null;

  const state = freshnessState(snap.last_synced_at);
  if (state === 'stale') return null;

  const [t, locale] = await Promise.all([
    getTranslations('landing.liveStrip'),
    getLocale(),
  ]);

  return (
    <Link
      href="/promos-today"
      aria-label={t('ariaLabel')}
      className="group block w-full border-b border-loftly-teal/20 bg-loftly-teal-soft text-body-sm"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2 md:px-6">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-loftly-ink">
          <span
            aria-hidden="true"
            className={cn(
              'inline-block h-2 w-2 shrink-0 rounded-full',
              DOT_COLOR[state],
            )}
          />
          <span className="font-semibold">
            {t('liveWith', { count: snap.active_promos })}
          </span>
          <span aria-hidden="true" className="text-loftly-divider">
            ·
          </span>
          <span>{t('banks', { count: snap.banks })}</span>
          {snap.merchants ? (
            <>
              <span aria-hidden="true" className="text-loftly-divider">
                ·
              </span>
              <span>{t('merchants', { count: snap.merchants })}</span>
            </>
          ) : null}
          <span aria-hidden="true" className="text-loftly-divider">
            ·
          </span>
          <span className="text-loftly-ink-muted">
            {t('updated', { ago: relativeAge(snap.last_synced_at, locale) })}
          </span>
        </span>
        <span className="hidden text-loftly-teal transition-colors group-hover:text-loftly-teal-hover sm:inline">
          {t('cta')}
        </span>
      </div>
    </Link>
  );
}

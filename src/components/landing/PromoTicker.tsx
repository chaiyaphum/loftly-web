import { getTranslations } from 'next-intl/server';
import { getApiBase } from '@/lib/api/client';

/**
 * PromoTicker — full-bleed infinite-scroll strip of expiring promos
 * (design_handoff §Component 3). Pulls from /v1/promos?active=true and
 * duplicates the list once so the CSS translateX(-50%) loop is seamless.
 *
 * Silent-fail on unreachable API; returns null (landing page still reads
 * fine without the strip).
 */

type ApiPromo = {
  id: string;
  title_th?: string | null;
  title_en?: string | null;
  merchant_name?: string | null;
  merchant_name_th?: string | null;
  merchant_slug?: string | null;
  discount_value?: string | null;
  card_name?: string | null;
  expires_at?: string | null;
};

async function fetchPromos(): Promise<ApiPromo[]> {
  const base = getApiBase();
  try {
    const res = await fetch(
      `${base}/promos?active=true&sort=expires_at_asc&limit=14`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: ApiPromo[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function urgencyClass(days: number | null): string {
  if (days === null) return 'bg-loftly-surface-muted text-loftly-ink-muted';
  if (days <= 3) return 'bg-loftly-danger-soft text-loftly-danger';
  if (days <= 7) return 'bg-loftly-amber-soft text-loftly-amber-urgent';
  return 'bg-loftly-surface-muted text-loftly-ink-muted';
}

export async function PromoTicker() {
  const promos = await fetchPromos();
  if (promos.length === 0) return null;

  const t = await getTranslations('landing.promoTicker');
  const rows = [...promos, ...promos]; // duplicate for seamless loop

  return (
    <section
      className="relative overflow-hidden border-y border-loftly-divider bg-loftly-surface py-7"
      aria-labelledby="promo-ticker-heading"
    >
      <div className="mx-auto mb-3 flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-loftly-danger shadow-[0_0_0_4px_rgb(var(--loftly-danger)/0.15)]"
          />
          <span
            id="promo-ticker-heading"
            className="text-caption font-semibold uppercase tracking-[0.08em] text-loftly-ink-subtle"
          >
            {t('heading')}
          </span>
        </div>
        <span className="text-caption text-loftly-ink-subtle">{t('subheading')}</span>
      </div>
      <div
        className="relative"
        style={{
          maskImage:
            'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        }}
      >
        <ul className="flex w-max gap-3 animate-loftly-ticker">
          {rows.map((p, i) => {
            const days = daysUntil(p.expires_at);
            const merchant = p.merchant_name_th ?? p.merchant_name ?? p.merchant_slug ?? '—';
            const offer = p.discount_value ?? p.title_th ?? p.title_en ?? '';
            return (
              <li
                key={`${p.id}-${i}`}
                className="flex shrink-0 items-center gap-3 rounded-full border border-loftly-divider bg-loftly-warm-white px-4 py-2.5 text-body-sm"
              >
                <span className="font-semibold text-loftly-ink">{merchant}</span>
                {offer ? (
                  <>
                    <span aria-hidden className="text-loftly-ink-muted">·</span>
                    <span className="text-loftly-ink">{offer}</span>
                  </>
                ) : null}
                {p.card_name ? (
                  <span className="text-caption text-loftly-ink-subtle">{p.card_name}</span>
                ) : null}
                {days !== null ? (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${urgencyClass(days)}`}
                  >
                    {t('daysLeft', { count: days })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

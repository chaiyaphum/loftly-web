import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getApiBase } from '@/lib/api/client';

/**
 * TopPromosCarousel — horizontal scroll of top active promos (brief
 * §15.3 section 1). SSR from `/v1/promos?sort=relevance&limit=8`; each
 * tile links to its merchant page for the drill-down.
 *
 * Silent-fail philosophy — render nothing when the API is unreachable
 * or returns an empty list. The landing page reads fine without this
 * section and it's better to omit than to show a skeleton that implies
 * liveness we can't deliver.
 */

type ApiPromo = {
  id: string;
  merchant_slug?: string;
  merchant_name?: string;
  merchant_name_th?: string;
  discount_label?: string;
  expires_at?: string;
  bank_name?: string;
  card_name?: string;
};

const REVALIDATE_SECONDS = 300;

async function fetchTopPromos(): Promise<ApiPromo[]> {
  const base = getApiBase();
  const url = `${base}/promos?active=true&sort=relevance&limit=8`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: ApiPromo[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

function daysUntil(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export async function TopPromosCarousel() {
  const promos = await fetchTopPromos();
  if (promos.length === 0) return null;

  const t = await getTranslations('landing');

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="top-promos-heading"
    >
      <div className="flex items-end justify-between">
        <h2
          id="top-promos-heading"
          className="text-heading-lg text-loftly-ink"
        >
          {t('topPromosTitle')}
        </h2>
        <Link
          href="/promos-today"
          className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
        >
          {t('topPromosViewAll')} →
        </Link>
      </div>
      <div className="-mx-4 overflow-x-auto pb-2 md:-mx-6">
        <ul className="flex gap-3 px-4 md:px-6">
          {promos.map((promo) => {
            const days = daysUntil(promo.expires_at);
            const urgent = days !== null && days <= 21;
            const veryUrgent = days !== null && days <= 7;
            const href = promo.merchant_slug
              ? `/merchants/${promo.merchant_slug}`
              : '/promos-today';
            return (
              <li
                key={promo.id}
                className="w-64 shrink-0 md:w-72"
              >
                <Link
                  href={href}
                  className="group flex h-full flex-col gap-3 rounded-lg border border-loftly-divider bg-loftly-surface p-4 shadow-subtle transition-colors hover:border-loftly-teal hover:shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-body-sm font-semibold text-loftly-ink">
                      {promo.merchant_name ?? promo.merchant_slug ?? '—'}
                    </span>
                    {days !== null ? (
                      <span
                        className={
                          'shrink-0 rounded-full px-2 py-0.5 text-caption font-medium ' +
                          (veryUrgent
                            ? 'bg-loftly-danger/10 text-loftly-danger'
                            : urgent
                              ? 'bg-loftly-amber/15 text-loftly-amber-urgent'
                              : 'bg-loftly-teal-soft text-loftly-teal')
                        }
                      >
                        {t('topPromosExpiry', { days })}
                      </span>
                    ) : null}
                  </div>
                  {promo.discount_label ? (
                    <p className="line-clamp-2 text-heading font-semibold text-loftly-teal">
                      {promo.discount_label}
                    </p>
                  ) : null}
                  <p className="mt-auto flex items-center gap-1 text-caption text-loftly-ink-muted group-hover:text-loftly-teal">
                    {promo.bank_name && promo.card_name
                      ? t('topPromosWithCard', {
                          bank: promo.bank_name,
                          card: promo.card_name,
                        })
                      : t('topPromosViewDetails')}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

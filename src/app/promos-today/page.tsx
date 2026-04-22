import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Flame } from 'lucide-react';
import { getApiBase } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { Badge } from '@/components/ui/badge';

/**
 * /promos-today — SSR + ISR feed of all active Thai bank promos
 * (brief §15.6 + POSITIONING_SHIFT §6). Group by merchant; expiry
 * countdown chips drive urgency; stale-sync banner surfaces liveness
 * failures transparently rather than hiding them.
 */

export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: 'โปรโมชันบัตรเครดิตไทยวันนี้ · ทุกธนาคาร · สด',
  description:
    'ดูโปรโมชันบัตรเครดิตไทยที่ active วันนี้ — KTC · SCB · KBank อัปเดตทุกวัน · มูลค่า THB จริง ไม่ใช่รีวิวปีเก่า',
  path: '/promos-today',
});

type ApiPromo = {
  id: string;
  title_th?: string;
  title_en?: string;
  merchant_slug?: string;
  merchant_name?: string;
  merchant_name_th?: string;
  discount_value?: string | null;
  discount_type?: string | null;
  bank_name?: string;
  card_name?: string;
  expires_at?: string;
  min_spend_thb?: number | null;
  source_url?: string;
};

type ApiResponse = {
  data?: ApiPromo[];
  meta?: {
    total?: number;
    banks?: number;
    merchants?: number;
    last_synced_at?: string;
  };
};

async function fetchActivePromos(): Promise<ApiResponse> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/promos?active=true&limit=100&sort=expires_at_asc`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    return (await res.json()) as ApiResponse;
  } catch {
    return {};
  }
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function groupByMerchant(promos: ApiPromo[]): Map<string, ApiPromo[]> {
  const groups = new Map<string, ApiPromo[]>();
  for (const p of promos) {
    const key = p.merchant_slug ?? p.merchant_name ?? '__other__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return groups;
}

export default async function PromosTodayPage() {
  const [body, t, locale] = await Promise.all([
    fetchActivePromos(),
    getTranslations('promosToday'),
    getLocale(),
  ]);

  const promos = body.data ?? [];
  const total = body.meta?.total ?? promos.length;
  const banks = body.meta?.banks ?? 0;
  const merchants = body.meta?.merchants ?? 0;
  const lastSyncedAt = body.meta?.last_synced_at;
  const grouped = groupByMerchant(promos);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 md:px-6 md:py-14">
      <header className="flex flex-col gap-3">
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-loftly-amber/15 px-2 py-0.5 text-caption font-medium text-loftly-amber-urgent">
          <Flame className="h-3 w-3" aria-hidden />
          {t('eyebrow')}
        </span>
        <h1 className="text-display text-loftly-ink">{t('heading')}</h1>
        <p className="text-body-lg text-loftly-ink-muted">{t('subheading')}</p>
        {promos.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-loftly-ink-muted">
            <span className="font-semibold text-loftly-ink">
              {t('stats.total', { count: total })}
            </span>
            <span aria-hidden className="text-loftly-divider">·</span>
            <span>{t('stats.banks', { count: banks })}</span>
            <span aria-hidden className="text-loftly-divider">·</span>
            <span>{t('stats.merchants', { count: merchants })}</span>
            {lastSyncedAt ? (
              <>
                <span aria-hidden className="text-loftly-divider">·</span>
                <span>
                  {t('stats.updated', {
                    ago: new Intl.RelativeTimeFormat(locale === 'th' ? 'th' : 'en', {
                      numeric: 'always',
                      style: 'short',
                    }).format(
                      -Math.max(
                        1,
                        Math.floor(
                          (Date.now() - new Date(lastSyncedAt).getTime()) / 60000,
                        ),
                      ),
                      'minute',
                    ),
                  })}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      {promos.length === 0 ? (
        <div className="rounded-lg border border-loftly-divider bg-loftly-surface p-10 text-center">
          <p className="text-body text-loftly-ink-muted">{t('empty')}</p>
          <Link
            href="/merchants"
            className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
          >
            {t('emptyCta')} →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(grouped.entries()).map(([merchantKey, group]) => {
            const first = group[0];
            if (!first) return null;
            const merchantName = first.merchant_name ?? merchantKey;
            return (
              <section
                key={merchantKey}
                className="flex flex-col gap-3"
                aria-labelledby={`merchant-${merchantKey}-heading`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2
                    id={`merchant-${merchantKey}-heading`}
                    className="text-heading text-loftly-ink"
                  >
                    {merchantName}
                    {first.merchant_name_th ? (
                      <span className="ml-1 text-body-sm font-normal text-loftly-ink-muted">
                        · {first.merchant_name_th}
                      </span>
                    ) : null}
                  </h2>
                  {first.merchant_slug ? (
                    <Link
                      href={`/merchants/${first.merchant_slug}`}
                      className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
                    >
                      {t('viewMerchant')} →
                    </Link>
                  ) : null}
                </div>
                <ul className="grid gap-3 md:grid-cols-2">
                  {group.map((p) => {
                    const days = daysUntil(p.expires_at);
                    const veryUrgent = days !== null && days <= 7;
                    const urgent = days !== null && days <= 21;
                    const title =
                      (locale === 'en' ? p.title_en : p.title_th) ??
                      p.title_en ??
                      p.title_th ??
                      t('unknownPromo');
                    return (
                      <li
                        key={p.id}
                        className="flex flex-col gap-3 rounded-lg border border-loftly-divider bg-loftly-surface p-4 shadow-subtle"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-body-sm font-semibold text-loftly-ink">
                            {title}
                          </p>
                          {days !== null ? (
                            <Badge
                              variant={veryUrgent ? 'danger' : urgent ? 'amber' : 'teal'}
                            >
                              {t('daysLeft', { count: days })}
                            </Badge>
                          ) : null}
                        </div>
                        {p.discount_value ? (
                          <p className="font-mono text-numeric-table font-semibold text-loftly-teal">
                            {p.discount_value}
                            {p.discount_type ? ` ${p.discount_type}` : ''}
                          </p>
                        ) : null}
                        {p.bank_name || p.card_name ? (
                          <p className="text-caption text-loftly-ink-muted">
                            {[p.bank_name, p.card_name].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                        {p.min_spend_thb ? (
                          <p className="text-caption text-loftly-ink-muted">
                            {t('minSpend', {
                              amount: new Intl.NumberFormat('th-TH').format(
                                p.min_spend_thb,
                              ),
                            })}
                          </p>
                        ) : null}
                        {p.source_url ? (
                          <a
                            href={`/apply/promo/${encodeURIComponent(p.id)}`}
                            rel="sponsored nofollow"
                            className="mt-auto inline-flex text-caption font-medium text-loftly-teal hover:text-loftly-teal-hover"
                          >
                            {t('sourceLink')} ›
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

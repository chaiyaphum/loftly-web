import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getApiBase } from '@/lib/api/client';

/**
 * PersonalizedPromos — top-5 live promo list below TopMerchantsGrid.
 *
 * "Personalized" is deliberately signal-based, not ML-personalized (yet —
 * we don't reliably have user-specific spend profiles on anon visits).
 * The rank is a composite of three factual signals:
 *
 *   1. Urgency    — days remaining ascending (close to expiry bubble up)
 *   2. Value      — percentage discount OR THB amount, normalised
 *   3. Freshness  — `valid_from` ascending (newer promos slight bump)
 *
 * Each row surfaces a "reason" pill so the reader understands why it's
 * here — "หมดเร็ว" (≤7d) / "ประหยัดเยอะ" (high %/THB) / "เพิ่งเพิ่ม" (valid_from < 7d ago).
 * Silent-fail pattern: if the API returns zero active promos, render nothing.
 *
 * Source data: `/v1/promos?active=true&page_size=20&expiring_within_days=60`
 * — real deal-harvester scrapes, refreshed via `X-Promo-Sync-Age-Hours`.
 */

interface ApiBank {
  slug?: string;
  name_th?: string;
  name_en?: string;
}

interface ApiPromoItem {
  id: string;
  bank?: ApiBank | null;
  merchant_name?: string | null;
  merchant_canonical?: { slug?: string; name_th?: string; name_en?: string } | null;
  title_th?: string | null;
  title_en?: string | null;
  discount_type?: string | null;
  discount_value?: string | null;
  discount_amount?: string | number | null;
  discount_unit?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  source_url?: string | null;
  promo_type?: string | null;
  category?: string | null;
}

interface ApiResponse {
  items?: ApiPromoItem[];
  data?: ApiPromoItem[];
  total?: number;
}

const REVALIDATE_SECONDS = 300;

async function fetchActivePromos(): Promise<ApiPromoItem[]> {
  const base = getApiBase();
  try {
    const res = await fetch(
      `${base}/promos?active=true&page_size=20&expiring_within_days=60`,
      { headers: { Accept: 'application/json' }, next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as ApiResponse;
    return body.items ?? body.data ?? [];
  } catch {
    return [];
  }
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function discountMagnitude(p: ApiPromoItem): number {
  const amount = typeof p.discount_amount === 'number'
    ? p.discount_amount
    : p.discount_amount
      ? Number.parseFloat(p.discount_amount)
      : 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  // Percent and THB don't share a scale; normalise:
  //   percent → clamp to 0..30 (30%+ is exceptional)
  //   THB → log10 to dampen outliers (200k baht vs 500 baht)
  if (p.discount_unit === 'percent') return Math.min(amount, 30);
  if (p.discount_unit === 'thb') return Math.min(Math.log10(amount + 1) * 6, 25);
  return 0;
}

/** Composite score: lower = higher priority (sorted ascending). */
function rankScore(p: ApiPromoItem): number {
  const days = daysUntil(p.valid_until);
  const urgency = days === null ? 365 : days; // null = treat as far future
  const value = discountMagnitude(p); // 0..~30
  const freshnessSince = daysSince(p.valid_from) ?? 30;
  // Primary key: expiry urgency. Tie-break: higher value first (subtract).
  // Bonus: very fresh (< 7 days old) pulls forward 3 days worth of urgency.
  const freshBonus = freshnessSince < 7 ? 3 : 0;
  return urgency - value * 0.3 - freshBonus;
}

function dedupeByKey<T>(list: T[], key: (t: T) => string | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const k = key(item);
    if (k === null) {
      out.push(item);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

type Reason = 'expiring' | 'valuable' | 'fresh' | null;

function reasonFor(p: ApiPromoItem): Reason {
  const days = daysUntil(p.valid_until);
  if (days !== null && days <= 7) return 'expiring';
  const mag = discountMagnitude(p);
  if (mag >= 10) return 'valuable';
  const fresh = daysSince(p.valid_from);
  if (fresh !== null && fresh < 7) return 'fresh';
  return null;
}

function merchantLabel(p: ApiPromoItem): string | null {
  return (
    p.merchant_canonical?.name_th ??
    p.merchant_canonical?.name_en ??
    p.merchant_name ??
    null
  );
}

function titleFor(p: ApiPromoItem, locale: string): string {
  return (locale === 'en' ? p.title_en : p.title_th) ?? p.title_en ?? p.title_th ?? '—';
}

export async function PersonalizedPromos() {
  const [promos, t, locale] = await Promise.all([
    fetchActivePromos(),
    getTranslations('landing.personalizedPromos'),
    getLocale(),
  ]);

  if (promos.length === 0) return null;

  const ranked = [...promos].sort((a, b) => rankScore(a) - rankScore(b));
  // Dedupe by merchant when the merchant is known; null merchants all pass through.
  const deduped = dedupeByKey(ranked, (p) => p.merchant_canonical?.slug ?? p.merchant_name ?? null);
  const top = deduped.slice(0, 5);

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="personalized-promos-heading"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-loftly-teal">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t('eyebrow')}
          </p>
          <h2
            id="personalized-promos-heading"
            className="text-heading-lg text-loftly-ink"
          >
            {t('heading')}
          </h2>
          <p className="mt-1 text-body-sm text-loftly-ink-muted">
            {t('subheading')}
          </p>
        </div>
        <Link
          href="/promos-today"
          className="shrink-0 text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
        >
          {t('viewAll')} →
        </Link>
      </div>

      <ul className="flex flex-col gap-2.5">
        {top.map((p) => {
          const days = daysUntil(p.valid_until);
          const veryUrgent = days !== null && days <= 3;
          const urgent = days !== null && days <= 7;
          const merchant = merchantLabel(p);
          const title = titleFor(p, locale);
          const reason = reasonFor(p);
          const bankName = p.bank?.name_th ?? p.bank?.name_en ?? null;
          const merchantSlug = p.merchant_canonical?.slug ?? null;
          const href = p.source_url
            ? `/apply/promo/${encodeURIComponent(p.id)}`
            : merchantSlug
              ? `/merchants/${merchantSlug}`
              : '/promos-today';

          return (
            <li key={p.id}>
              <Link
                href={href}
                className="group flex items-start gap-4 rounded-lg border border-loftly-divider bg-loftly-surface p-4 transition-all hover:-translate-y-0.5 hover:border-loftly-teal hover:shadow md:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {merchant ? (
                      <span className="text-body-sm font-semibold text-loftly-ink">
                        {merchant}
                      </span>
                    ) : null}
                    {bankName ? (
                      <span className="text-caption text-loftly-ink-subtle">
                        · {bankName}
                      </span>
                    ) : null}
                    {reason ? (
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ' +
                          (reason === 'expiring'
                            ? 'bg-loftly-danger-soft text-loftly-danger'
                            : reason === 'valuable'
                              ? 'bg-loftly-teal-soft text-loftly-teal'
                              : 'bg-loftly-amber-soft text-loftly-amber-urgent')
                        }
                      >
                        {reason === 'expiring' ? (
                          <Flame className="h-3 w-3" aria-hidden />
                        ) : reason === 'valuable' ? (
                          <TrendingUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <Sparkles className="h-3 w-3" aria-hidden />
                        )}
                        {t(`reason.${reason}`)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-body text-loftly-ink">
                    {title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-loftly-ink-muted">
                    {p.discount_value ? (
                      <span className="font-mono font-semibold text-loftly-teal">
                        {p.discount_value}
                      </span>
                    ) : null}
                    {days !== null ? (
                      <span
                        className={
                          veryUrgent
                            ? 'font-semibold text-loftly-danger'
                            : urgent
                              ? 'font-semibold text-loftly-amber-urgent'
                              : ''
                        }
                      >
                        {t('daysLeft', { count: days })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ArrowRight
                  className="mt-1 h-4 w-4 shrink-0 text-loftly-ink-subtle transition-all group-hover:translate-x-0.5 group-hover:text-loftly-teal"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-caption text-loftly-ink-subtle">
        {t('rankingFootnote')}
      </p>
    </section>
  );
}

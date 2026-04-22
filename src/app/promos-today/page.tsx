import type { Metadata } from 'next';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { getApiBase } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { Badge } from '@/components/ui/badge';

/**
 * `/promos-today` — public discovery feed of currently-active promos.
 *
 * SSR + 5min ISR (cache TTL matches API). Data shape mirrors
 * `mvp/API_CONTRACT.md §Promos` — the live staging endpoint returns
 * `{ items, total, page, page_size, pages }`. We also read the
 * `X-Promo-Sync-Age-Hours` response header so the footer can surface
 * upstream-sync liveness (or "unknown" when the backend cannot
 * determine it, per deal-harvester §staging semantics).
 *
 * Filtering: simple bank + category pills, URL-state preserved via
 * `?bank=<slug>&category=<slug>` query params so the page is
 * shareable + crawlable.
 */

export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: 'โปรโมชันบัตรเครดิตไทยวันนี้ · ทุกธนาคาร · สด',
  description:
    'ดูโปรโมชันบัตรเครดิตไทยที่ active วันนี้ — KTC · SCB · KBank อัปเดตทุกวัน · มูลค่า THB จริง ไม่ใช่รีวิวปีเก่า',
  path: '/promos-today',
});

interface ApiBank {
  id?: string;
  slug?: string;
  name_th?: string;
  name_en?: string;
}

interface ApiMerchantCanonical {
  slug?: string;
  name_th?: string;
  name_en?: string;
}

interface ApiPromoItem {
  id: string;
  bank?: ApiBank | null;
  merchant_name?: string | null;
  merchant_canonical?: ApiMerchantCanonical | null;
  title_th?: string | null;
  title_en?: string | null;
  description_th?: string | null;
  image_url?: string | null;
  category?: string | null;
  promo_type?: string | null;
  discount_type?: string | null;
  discount_value?: string | null;
  discount_amount?: number | null;
  discount_unit?: string | null;
  minimum_spend?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  source_url?: string | null;
  card_ids?: string[];
  last_synced_at?: string | null;
}

interface ApiPromoResponse {
  items?: ApiPromoItem[];
  /** Legacy field name — some older deployments return `data` instead. */
  data?: ApiPromoItem[];
  total?: number;
  page?: number;
  page_size?: number;
  pages?: number;
}

interface FetchResult {
  promos: ApiPromoItem[];
  total: number;
  syncAgeHours: string | null;
  ok: boolean;
}

async function fetchActivePromos(): Promise<FetchResult> {
  const base = getApiBase();
  const url = `${base}/promos?page_size=30&active=true&expiring_within_days=60`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return { promos: [], total: 0, syncAgeHours: null, ok: false };
    }
    const body = (await res.json()) as ApiPromoResponse;
    const items = body.items ?? body.data ?? [];
    return {
      promos: items,
      total: body.total ?? items.length,
      syncAgeHours: res.headers.get('x-promo-sync-age-hours'),
      ok: true,
    };
  } catch {
    return { promos: [], total: 0, syncAgeHours: null, ok: false };
  }
}

function formatValidUntil(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return null;
  }
}

function merchantLabel(p: ApiPromoItem): string {
  return (
    p.merchant_canonical?.name_th ??
    p.merchant_name ??
    p.title_th ??
    p.title_en ??
    'โปรโมชัน'
  );
}

function uniqueBankOptions(
  promos: ApiPromoItem[],
): Array<{ slug: string; label: string }> {
  const map = new Map<string, string>();
  for (const p of promos) {
    const slug = p.bank?.slug;
    if (!slug) continue;
    if (!map.has(slug)) {
      map.set(slug, p.bank?.name_th ?? p.bank?.name_en ?? slug.toUpperCase());
    }
  }
  return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
}

function uniqueCategoryOptions(promos: ApiPromoItem[]): string[] {
  const set = new Set<string>();
  for (const p of promos) {
    if (p.category) set.add(p.category);
  }
  return Array.from(set.values()).sort();
}

function applyFilters(
  promos: ApiPromoItem[],
  filters: { bank?: string; category?: string },
): ApiPromoItem[] {
  return promos.filter((p) => {
    if (filters.bank && p.bank?.slug !== filters.bank) return false;
    if (filters.category && p.category !== filters.category) return false;
    return true;
  });
}

function buildPillHref(
  params: { bank?: string; category?: string },
  patch: { bank?: string | null; category?: string | null },
): string {
  const next: Record<string, string> = {};
  if (params.bank) next.bank = params.bank;
  if (params.category) next.category = params.category;
  if (patch.bank === null) delete next.bank;
  else if (patch.bank) next.bank = patch.bank;
  if (patch.category === null) delete next.category;
  else if (patch.category) next.category = patch.category;
  const qs = new URLSearchParams(next).toString();
  return qs ? `/promos-today?${qs}` : '/promos-today';
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function PromosTodayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const bankFilter = firstString(sp.bank);
  const categoryFilter = firstString(sp.category);

  const { promos: allPromos, total, syncAgeHours, ok } =
    await fetchActivePromos();

  const bankOptions = uniqueBankOptions(allPromos);
  const categoryOptions = uniqueCategoryOptions(allPromos);
  const filtered = applyFilters(allPromos, {
    bank: bankFilter,
    category: categoryFilter,
  });
  const visibleTotal = filtered.length;
  const hasFilter = Boolean(bankFilter || categoryFilter);

  const syncAgeLabel = (() => {
    if (syncAgeHours === null) return null;
    if (syncAgeHours === 'unknown') {
      return 'ข้อมูลซิงก์ล่าสุด: ไม่ทราบเวลา (กำลังเชื่อมต่อกับ deal-harvester)';
    }
    const hours = Number(syncAgeHours);
    if (!Number.isFinite(hours)) return null;
    if (hours < 1) return 'ข้อมูลซิงก์ล่าสุดไม่ถึง 1 ชม.ที่แล้ว';
    return `ข้อมูลซิงก์ล่าสุด ${Math.round(hours)} ชม. ที่แล้ว`;
  })();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 md:px-6 md:py-14">
      <header className="flex flex-col gap-3">
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-loftly-amber/15 px-2 py-0.5 text-caption font-medium text-loftly-amber-urgent">
          <Flame className="h-3 w-3" aria-hidden />
          สด · อัปเดตทุกวัน
        </span>
        <h1 className="text-display text-loftly-ink">
          โปรโมชันบัตรเครดิตไทย วันนี้
        </h1>
        <p className="text-body-lg text-loftly-ink-muted">
          ทุกโปรที่ active จากธนาคารไทย — KTC · SCB · KBank พร้อมวันหมดอายุจริง ไม่ใช่รีวิวปีเก่า
        </p>
        <p
          className="text-body-sm font-semibold text-loftly-ink"
          data-testid="promos-count"
        >
          มี {total} โปรที่ใช้ได้ตอนนี้
          {hasFilter && visibleTotal !== total
            ? ` · ${visibleTotal} ตรงกับตัวกรอง`
            : ''}
        </p>
      </header>

      {(bankOptions.length > 0 || categoryOptions.length > 0) && (
        <section
          aria-label="ตัวกรอง"
          className="flex flex-col gap-3"
          data-testid="promos-filters"
        >
          {bankOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption font-medium text-loftly-ink-muted">
                ธนาคาร:
              </span>
              <Link
                href={buildPillHref(
                  { bank: bankFilter, category: categoryFilter },
                  { bank: null },
                )}
                className={`rounded-full px-3 py-1 text-caption font-medium transition ${
                  bankFilter
                    ? 'border border-loftly-divider bg-loftly-surface text-loftly-ink-muted hover:border-loftly-teal'
                    : 'bg-loftly-ink text-white'
                }`}
              >
                ทั้งหมด
              </Link>
              {bankOptions.map((b) => {
                const active = bankFilter === b.slug;
                return (
                  <Link
                    key={b.slug}
                    href={buildPillHref(
                      { bank: bankFilter, category: categoryFilter },
                      { bank: active ? null : b.slug },
                    )}
                    className={`rounded-full px-3 py-1 text-caption font-medium transition ${
                      active
                        ? 'bg-loftly-ink text-white'
                        : 'border border-loftly-divider bg-loftly-surface text-loftly-ink-muted hover:border-loftly-teal'
                    }`}
                    aria-pressed={active}
                  >
                    {b.label}
                  </Link>
                );
              })}
            </div>
          )}
          {categoryOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption font-medium text-loftly-ink-muted">
                หมวดหมู่:
              </span>
              <Link
                href={buildPillHref(
                  { bank: bankFilter, category: categoryFilter },
                  { category: null },
                )}
                className={`rounded-full px-3 py-1 text-caption font-medium transition ${
                  categoryFilter
                    ? 'border border-loftly-divider bg-loftly-surface text-loftly-ink-muted hover:border-loftly-teal'
                    : 'bg-loftly-ink text-white'
                }`}
              >
                ทั้งหมด
              </Link>
              {categoryOptions.map((c) => {
                const active = categoryFilter === c;
                return (
                  <Link
                    key={c}
                    href={buildPillHref(
                      { bank: bankFilter, category: categoryFilter },
                      { category: active ? null : c },
                    )}
                    className={`rounded-full px-3 py-1 text-caption font-medium transition ${
                      active
                        ? 'bg-loftly-ink text-white'
                        : 'border border-loftly-divider bg-loftly-surface text-loftly-ink-muted hover:border-loftly-teal'
                    }`}
                    aria-pressed={active}
                  >
                    {c}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {filtered.length === 0 ? (
        <div
          className="rounded-lg border border-loftly-divider bg-loftly-surface p-10 text-center"
          data-testid="promos-empty"
        >
          <p className="text-body text-loftly-ink-muted">
            {ok
              ? hasFilter
                ? 'ไม่มีโปรที่ตรงกับตัวกรอง ลองล้างตัวกรองดูนะ'
                : 'ไม่มีโปรที่ใช้ได้ตอนนี้'
              : 'โหลดข้อมูลโปรโมชันไม่สำเร็จ — กรุณาลองใหม่ในอีกสักครู่'}
          </p>
          {hasFilter && (
            <Link
              href="/promos-today"
              className="mt-4 inline-flex items-center gap-1 text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
            >
              ล้างตัวกรอง →
            </Link>
          )}
        </div>
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          data-testid="promos-grid"
        >
          {filtered.map((p) => {
            const validUntilLabel = formatValidUntil(p.valid_until);
            const mainTitle = merchantLabel(p);
            const bankSlug = p.bank?.slug;
            const merchantSlug = p.merchant_canonical?.slug;
            return (
              <li
                key={p.id}
                data-testid="promo-card"
                className="flex flex-col gap-3 rounded-lg border border-loftly-divider bg-loftly-surface p-4 shadow-subtle"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-body-sm font-semibold text-loftly-ink">
                    {mainTitle}
                  </h2>
                  {bankSlug && (
                    <Badge variant="outline" className="uppercase">
                      {bankSlug}
                    </Badge>
                  )}
                </div>

                {p.discount_value ? (
                  <p className="font-mono text-numeric-table font-semibold text-loftly-teal">
                    {p.discount_value}
                  </p>
                ) : p.title_th ? (
                  <p className="text-body-sm text-loftly-ink">{p.title_th}</p>
                ) : null}

                {p.category && (
                  <p className="text-caption text-loftly-ink-muted">
                    หมวดหมู่: {p.category}
                  </p>
                )}

                {typeof p.minimum_spend === 'number' && p.minimum_spend > 0 && (
                  <p className="text-caption text-loftly-ink-muted">
                    ยอดขั้นต่ำ THB{' '}
                    {new Intl.NumberFormat('th-TH').format(p.minimum_spend)}
                  </p>
                )}

                {validUntilLabel && (
                  <p className="text-caption text-loftly-ink-muted">
                    ก่อน {validUntilLabel}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {merchantSlug ? (
                    <Link
                      href={`/merchants/${merchantSlug}`}
                      className="text-caption font-medium text-loftly-teal hover:text-loftly-teal-hover"
                    >
                      ดูหน้าร้าน →
                    </Link>
                  ) : (
                    <span />
                  )}
                  {p.source_url && (
                    <a
                      href={p.source_url}
                      rel="sponsored nofollow noopener"
                      target="_blank"
                      className="text-caption font-medium text-loftly-ink-muted hover:text-loftly-teal"
                    >
                      เงื่อนไขธนาคาร ›
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {syncAgeLabel && (
        <footer
          className="rounded-md border border-loftly-divider bg-loftly-surface px-4 py-3 text-caption text-loftly-ink-muted"
          data-testid="promos-sync-banner"
        >
          {syncAgeLabel}
        </footer>
      )}
    </main>
  );
}

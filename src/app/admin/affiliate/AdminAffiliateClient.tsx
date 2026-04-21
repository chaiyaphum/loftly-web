'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getAffiliateStats,
  getAffiliateStatsCsvUrl,
  KNOWN_AFFILIATE_PARTNERS,
  listAffiliatePartners,
  type AffiliatePartner,
  type AffiliateStats,
} from '@/lib/api/admin';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Admin affiliate stats dashboard (W17).
 *
 * - Date-range picker (defaults to last 30 days, max 90 days window)
 * - Partner multi-select — populated from `/admin/affiliate/partners` when
 *   available, or the hardcoded `KNOWN_AFFILIATE_PARTNERS` list as fallback.
 * - Summary row pulled from `/admin/affiliate/stats` (30-day fixed window;
 *   backend does not yet honour `from`/`to` on this endpoint — flagged as a
 *   contract gap in the PR body).
 * - Top-20 table preview sourced from the stats payload's `by_card` list.
 * - Export CSV triggers a plain GET to `/admin/affiliate/stats.csv?...` via a
 *   programmatic anchor click. The admin JWT is appended as `?token=…` since
 *   a native `<a>` cannot set an Authorization header.
 *
 * `accessToken` is supplied by the server wrapper (`page.tsx`) after the
 * admin-role guard in `admin/layout.tsx` has cleared — the token already
 * crosses to the client in the existing dashboard via the download anchor.
 */

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;
const PREVIEW_ROWS = 20;

function toIsoDate(d: Date): string {
  // YYYY-MM-DD in UTC to match the backend's `_parse_iso_date` helper.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = toIsoDate(now);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));
  return { from: toIsoDate(fromDate), to };
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return -1;
  return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

function formatTHB(value: number): string {
  return `THB ${new Intl.NumberFormat('en-US').format(value)}`;
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

interface Props {
  accessToken: string;
}

export function AdminAffiliateClient({ accessToken }: Props) {
  const t = useTranslations('admin.affiliate');

  const [{ from, to }, setRange] = useState<{ from: string; to: string }>(
    () => defaultRange(),
  );
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [partners, setPartners] = useState<AffiliatePartner[]>(() => [
    ...KNOWN_AFFILIATE_PARTNERS,
  ]);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Partners — best-effort load, falls back to KNOWN_AFFILIATE_PARTNERS on 404.
  useEffect(() => {
    const controller = new AbortController();
    listAffiliatePartners(accessToken, { signal: controller.signal })
      .then((list) => {
        if (list.length > 0) setPartners(list);
      })
      .catch(() => {
        // Fall through — `partners` already holds the hardcoded list.
      });
    return () => controller.abort();
  }, [accessToken]);

  // Summary stats.
  useEffect(() => {
    const controller = new AbortController();
    setLoadingStats(true);
    setStatsError(null);
    getAffiliateStats(accessToken, { signal: controller.signal })
      .then((payload) => {
        setStats(payload);
      })
      .catch((err: unknown) => {
        if (err instanceof LoftlyAPIError) {
          setStatsError(err.message_en);
        } else if (err instanceof Error && err.name !== 'AbortError') {
          setStatsError(err.message);
        }
      })
      .finally(() => {
        setLoadingStats(false);
      });
    return () => controller.abort();
  }, [accessToken]);

  const rangeDays = daysBetween(from, to);
  const rangeError = useMemo(() => {
    if (rangeDays < 1) return t('invalidRange');
    if (rangeDays > MAX_RANGE_DAYS)
      return t('rangeTooLarge', { max: MAX_RANGE_DAYS });
    return null;
  }, [rangeDays, t]);

  const partnerIdForExport: string =
    selectedPartners.length === 1 ? (selectedPartners[0] ?? 'all') : 'all';

  const csvUrl = useMemo(
    () =>
      getAffiliateStatsCsvUrl(accessToken, {
        from,
        to,
        partnerId: partnerIdForExport,
      }),
    [accessToken, from, to, partnerIdForExport],
  );

  const onExportClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (rangeError) {
        e.preventDefault();
      }
    },
    [rangeError],
  );

  const previewRows = useMemo(() => {
    if (!stats) return [];
    return [...stats.by_card]
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, PREVIEW_ROWS);
  }, [stats]);

  const togglePartner = useCallback((id: string) => {
    setSelectedPartners((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-slate-500">
          {t('rangeSummary', { days: rangeDays > 0 ? rangeDays : 0 })}
        </p>
      </header>

      <div
        className="flex flex-wrap items-end gap-4 rounded-md border border-slate-200 bg-white p-4"
        data-testid="affiliate-filters"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('from')}</span>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            data-testid="affiliate-from"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('to')}</span>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            data-testid="affiliate-to"
          />
        </label>

        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t('partner')}</legend>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              <input
                type="checkbox"
                checked={selectedPartners.length === 0}
                onChange={() => setSelectedPartners([])}
                aria-label={t('all_partners')}
              />
              <span>{t('all_partners')}</span>
            </label>
            {partners.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={selectedPartners.includes(p.id)}
                  onChange={() => togglePartner(p.id)}
                  data-testid={`partner-${p.id}`}
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="ml-auto">
          <Button asChild variant="outline" className={rangeError ? 'opacity-50' : ''}>
            <a
              href={csvUrl}
              download
              onClick={onExportClick}
              aria-disabled={rangeError ? true : undefined}
              data-testid="affiliate-export-csv"
            >
              {t('export_csv')}
            </a>
          </Button>
        </div>
      </div>

      {rangeError && (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="affiliate-range-error"
        >
          {rangeError}
        </p>
      )}

      {statsError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          {statsError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label={t('total_clicks')}
          value={stats ? formatInt(stats.clicks) : loadingStats ? '…' : '—'}
        />
        <Metric
          label={t('total_conversions')}
          value={stats ? formatInt(stats.conversions) : loadingStats ? '…' : '—'}
        />
        <Metric
          label={t('commission_thb')}
          value={
            stats
              ? formatTHB(
                  stats.commission_pending_thb +
                    stats.commission_confirmed_thb +
                    stats.commission_paid_thb,
                )
              : loadingStats
                ? '…'
                : '—'
          }
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-4 py-2 text-sm font-medium">
          {t('previewTitle', { count: previewRows.length })}
        </div>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">{t('columnCard')}</th>
              <th className="px-4 py-2">{t('columnClicks')}</th>
              <th className="px-4 py-2">{t('columnConversions')}</th>
              <th className="px-4 py-2">{t('columnCommission')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {previewRows.map((r) => (
              <tr key={r.card_slug}>
                <td className="px-4 py-2 font-medium">{r.card_slug}</td>
                <td className="px-4 py-2">{formatInt(r.clicks)}</td>
                <td className="px-4 py-2">{formatInt(r.conversions)}</td>
                <td className="px-4 py-2">{formatTHB(r.commission_thb)}</td>
              </tr>
            ))}
            {previewRows.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-slate-500"
                  colSpan={4}
                >
                  {t('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

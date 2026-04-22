'use client';

import { useTranslations } from 'next-intl';
import type { CardComparison } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { cn, formatTHB } from '@/lib/utils';

/**
 * Side-by-side comparison table for the `/cards/[slug]` compare widget (W17).
 *
 * - On >= 768px renders three columns; on narrow screens each card stacks as
 *   its own labelled section (table rows become label/value pairs).
 * - Rows (per `DEV_PLAN` W17): display name, issuer, tier, annual fee, min
 *   income, earn rate by category (6 canonical categories:
 *   dining/online/grocery/travel/petrol/default), transfer partners, THB
 *   valuation of earn currency, Loftly score, Apply CTA.
 * - Gracefully handles missing `valuation`, `loftly_score`, or category-row
 *   gaps in `earn_rate_local` — renders "—" rather than blowing up.
 * - Empty state rendered when fewer than 2 comparisons are provided; the
 *   widget never calls the backend in that case but we double-guard here.
 */

const CATEGORY_ORDER: readonly string[] = [
  'dining',
  'online',
  'grocery',
  'travel',
  'petrol',
  'default',
] as const;

export interface CardCompareTableProps {
  comparisons: CardComparison[];
  className?: string;
}

export function CardCompareTable({
  comparisons,
  className,
}: CardCompareTableProps) {
  const t = useTranslations('cards.compare');
  const tc = useTranslations('common');

  if (comparisons.length < 2) {
    return (
      <p
        role="status"
        className={cn(
          'rounded-md border border-dashed border-loftly-divider bg-loftly-teal-soft/40 p-4 text-sm text-loftly-ink-muted',
          className,
        )}
      >
        {t('empty_state')}
      </p>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-loftly-divider bg-white',
        className,
      )}
      data-testid="card-compare-table"
    >
      {/* Mobile (stacked) + desktop (grid) — identical data, different DOM for
          readability on small screens. */}
      <div className="hidden md:block">
        <DesktopTable comparisons={comparisons} t={t} tc={tc} />
      </div>
      <div className="md:hidden">
        <MobileStack comparisons={comparisons} t={t} tc={tc} />
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function DesktopTable({
  comparisons,
  t,
  tc,
}: {
  comparisons: CardComparison[];
  t: T;
  tc: T;
}) {
  const cols = comparisons.length;
  return (
    <table className="w-full caption-bottom text-sm">
      <thead className="border-b bg-loftly-teal-soft/40 text-left">
        <tr>
          <th className="w-[180px] p-3 text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
            {t('columns.displayName')}
          </th>
          {comparisons.map(({ card }) => (
            <th
              key={card.id}
              className="p-3 text-sm font-semibold text-loftly-ink"
              scope="col"
            >
              {card.display_name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-loftly-divider">
        <Row label={t('columns.issuer')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm">
              {c.card.bank.display_name_th}
            </td>
          ))}
        </Row>
        <Row label={t('columns.tier')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm">
              {c.card.tier ?? '—'}
            </td>
          ))}
        </Row>
        <Row label={tc('annualFee')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm tabular-nums">
              {c.card.annual_fee_thb != null
                ? formatTHB(c.card.annual_fee_thb)
                : '—'}
            </td>
          ))}
        </Row>
        <Row label={tc('minIncome')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm tabular-nums">
              {c.card.min_income_thb != null
                ? formatTHB(c.card.min_income_thb)
                : '—'}
            </td>
          ))}
        </Row>

        {/* Category earn-rate section header */}
        <tr className="bg-loftly-teal-soft/40">
          <th
            colSpan={cols + 1}
            scope="colgroup"
            className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-loftly-ink-muted"
          >
            {t('earn_rate_by_category')}
          </th>
        </tr>
        {CATEGORY_ORDER.map((category) => (
          <Row key={category} label={t(`categories.${category}` as const)}>
            {comparisons.map((c) => {
              const rate = c.card.earn_rate_local?.[category];
              return (
                <td key={c.card.id} className="p-3 text-sm tabular-nums">
                  {typeof rate === 'number' ? `${rate}x` : '—'}
                </td>
              );
            })}
          </Row>
        ))}

        <Row label={t('transfer_partners')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm">
              {c.transfer_partners.length === 0 ? (
                '—'
              ) : (
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-loftly-ink">
                  {c.transfer_partners.slice(0, 5).map((p) => (
                    <li key={p.destination_code}>
                      {p.destination_display_name_th} ({p.ratio_source}:
                      {p.ratio_destination})
                    </li>
                  ))}
                </ul>
              )}
            </td>
          ))}
        </Row>
        <Row label={t('valuation')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm tabular-nums">
              {c.valuation
                ? `${c.valuation.thb_per_point.toFixed(2)} THB`
                : '—'}
            </td>
          ))}
        </Row>
        <Row label={t('score')}>
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3 text-sm tabular-nums">
              {c.loftly_score != null ? `${c.loftly_score} / 5` : '—'}
            </td>
          ))}
        </Row>
        <Row label="">
          {comparisons.map((c) => (
            <td key={c.card.id} className="p-3">
              <Button asChild size="sm" variant="outline">
                <a
                  href={`/apply/${c.card.id}`}
                  rel="sponsored nofollow"
                  aria-label={`${t('apply')} — ${c.card.display_name}`}
                >
                  {t('apply')}
                </a>
              </Button>
            </td>
          ))}
        </Row>
      </tbody>
    </table>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="p-3 text-left text-xs font-medium uppercase tracking-wide text-loftly-ink-muted"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function MobileStack({
  comparisons,
  t,
  tc,
}: {
  comparisons: CardComparison[];
  t: T;
  tc: T;
}) {
  return (
    <div className="divide-y divide-loftly-divider">
      {comparisons.map((c) => (
        <section key={c.card.id} className="space-y-2 p-4 text-sm">
          <header className="mb-2">
            <h3 className="text-base font-semibold text-loftly-ink">
              {c.card.display_name}
            </h3>
            <p className="text-xs text-loftly-ink-muted">
              {c.card.bank.display_name_th}
            </p>
          </header>
          <Dl label={t('columns.tier')}>{c.card.tier ?? '—'}</Dl>
          <Dl label={tc('annualFee')}>
            {c.card.annual_fee_thb != null
              ? formatTHB(c.card.annual_fee_thb)
              : '—'}
          </Dl>
          <Dl label={tc('minIncome')}>
            {c.card.min_income_thb != null
              ? formatTHB(c.card.min_income_thb)
              : '—'}
          </Dl>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
              {t('earn_rate_by_category')}
            </dt>
            <dd className="mt-1 grid grid-cols-2 gap-1 text-xs tabular-nums">
              {CATEGORY_ORDER.map((category) => {
                const rate = c.card.earn_rate_local?.[category];
                return (
                  <div key={category} className="flex justify-between gap-2">
                    <span className="text-loftly-ink-muted">
                      {t(`categories.${category}` as const)}
                    </span>
                    <span>
                      {typeof rate === 'number' ? `${rate}x` : '—'}
                    </span>
                  </div>
                );
              })}
            </dd>
          </div>
          <Dl label={t('transfer_partners')}>
            {c.transfer_partners.length === 0
              ? '—'
              : c.transfer_partners
                  .slice(0, 5)
                  .map((p) => p.destination_display_name_th)
                  .join(', ')}
          </Dl>
          <Dl label={t('valuation')}>
            {c.valuation ? `${c.valuation.thb_per_point.toFixed(2)} THB` : '—'}
          </Dl>
          <Dl label={t('score')}>
            {c.loftly_score != null ? `${c.loftly_score} / 5` : '—'}
          </Dl>
          <div className="pt-2">
            <Button asChild size="sm" variant="outline">
              <a
                href={`/apply/${c.card.id}`}
                rel="sponsored nofollow"
                aria-label={`${t('apply')} — ${c.card.display_name}`}
              >
                {t('apply')}
              </a>
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}

function Dl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
        {label}
      </dt>
      <dd className="text-right text-sm text-loftly-ink">{children}</dd>
    </div>
  );
}

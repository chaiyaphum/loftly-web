import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Card as CardT } from '@/lib/api/types';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ThaiNumberFormat,
  formatTHBFull,
} from '@/components/loftly/ThaiNumberFormat';
import { AffiliateDisclosure } from '@/components/loftly/AffiliateDisclosure';
import { cn } from '@/lib/utils';

/**
 * CardResultCard — the canonical card tile.
 *
 * Used on:
 *   - `/cards` index grid
 *   - `/selector/results/[id]` primary + secondary tiles
 *   - Landing "Latest reviews" preview
 *
 * Props:
 *   - `card`: the Card object from `/v1/cards` or `/v1/cards/{slug}`.
 *   - `role`: optional ranking role for selector results.
 *   - `earning`: monthly earning summary (only shown when present).
 *   - `position`: 1-based position for selector result instrumentation.
 */

export interface CardResultCardProps {
  card: CardT;
  role?: 'primary' | 'secondary' | 'tertiary';
  earning?: {
    monthly_thb?: number;
    monthly_points?: number;
  };
  position?: number;
  className?: string;
}

const roleVariant: Record<
  NonNullable<CardResultCardProps['role']>,
  'default' | 'outline' | 'warn' | 'success'
> = {
  primary: 'success',
  secondary: 'default',
  tertiary: 'outline',
};

export async function CardResultCard({
  card,
  role,
  earning,
  position,
  className,
}: CardResultCardProps) {
  const t = await getTranslations('cards');
  const tc = await getTranslations('common');

  return (
    <Card
      className={cn('flex flex-col', className)}
      data-position={position}
      data-role={role}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{card.display_name}</CardTitle>
            <p className="text-xs text-slate-500">
              {card.bank.display_name_th} · {card.network}
              {card.tier ? ` · ${card.tier}` : ''}
            </p>
          </div>
          {role && (
            <Badge variant={roleVariant[role]}>{t(`role.${role}`)}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        {card.annual_fee_thb !== null && card.annual_fee_thb !== undefined && (
          <p className="text-slate-700">
            {tc('annualFee')}:{' '}
            <span className="font-medium">
              <ThaiNumberFormat value={card.annual_fee_thb} />
            </span>
            {card.annual_fee_waiver && (
              <span className="text-slate-500"> ({card.annual_fee_waiver})</span>
            )}
          </p>
        )}

        {earning?.monthly_thb !== undefined && (
          <div className="rounded-md bg-emerald-50 p-3 text-emerald-900">
            <p className="text-xs font-medium uppercase tracking-wide">
              {t('monthlyEarning')}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatTHBFull(earning.monthly_thb)}
              {earning.monthly_points !== undefined && (
                <span className="ml-1 text-sm font-normal text-emerald-800">
                  (
                  {new Intl.NumberFormat('th-TH').format(earning.monthly_points)}{' '}
                  {card.earn_currency.code})
                </span>
              )}
            </p>
          </div>
        )}

        {card.description_th && (
          <p className="line-clamp-3 text-slate-700">{card.description_th}</p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-2">
        <div className="flex items-center gap-2">
          <Button asChild className="flex-1">
            <a href={`/apply/${card.id}`} rel="sponsored nofollow">
              {t('applyCta')}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/cards/${card.slug}`}>{t('viewReview')}</Link>
          </Button>
        </div>
        <AffiliateDisclosure variant="inline" />
      </CardFooter>
    </Card>
  );
}

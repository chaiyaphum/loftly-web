import { getTranslations } from 'next-intl/server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Earn-rate breakdown for the card review page (WF-4 `อัตราการสะสมแต้ม`).
 *
 * - Renders the `earn_rate_local` (primary) table.
 * - When `earn_rate_foreign` is present and not equal to the local rates, a
 *   second block renders below.
 * - Categories are preserved in their API order (deal-harvester + CMS enforce
 *   the canonical ordering: dining/online/grocery/travel/petrol/default).
 */

export interface CardEarnRateTableProps {
  earn_rate_local: Record<string, number>;
  earn_rate_foreign?: Record<string, number> | null;
  className?: string;
}

export async function CardEarnRateTable({
  earn_rate_local,
  earn_rate_foreign,
  className,
}: CardEarnRateTableProps) {
  const t = await getTranslations('cards.earnRate');

  const localEntries = Object.entries(earn_rate_local);
  const foreignEntries = earn_rate_foreign
    ? Object.entries(earn_rate_foreign)
    : [];

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-loftly-ink">
          {t('localTitle')}
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('category')}</TableHead>
              <TableHead>{t('multiplier')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localEntries.map(([category, rate]) => (
              <TableRow key={category}>
                <TableCell className="font-medium capitalize">
                  {category}
                </TableCell>
                <TableCell className="tabular-nums">
                  {rate}x
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {foreignEntries.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-loftly-ink">
            {t('foreignTitle')}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('category')}</TableHead>
                <TableHead>{t('multiplier')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreignEntries.map(([category, rate]) => (
                <TableRow key={category}>
                  <TableCell className="font-medium capitalize">
                    {category}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {rate}x
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AffiliateDisclosure } from '@/components/loftly/AffiliateDisclosure';
import type { MerchantRankedCard } from '@/lib/api/merchants';

/**
 * RankedCardList — the ordered card × promo × value list on
 * `/merchants/[slug]`. Reuses the look-and-feel of `CardResultCard` but
 * pivots the headline to merchant-specific value
 *   → "ได้ประมาณ ~฿X ต่อ ฿1,000 ที่ใช้จ่ายที่ {merchant}"
 *
 * Each row surfaces:
 *   - Rank badge (1..N)
 *   - Card name + bank
 *   - Merchant-specific value headline (est_value_per_1000_thb)
 *   - Applicable promos as chips (title_th, discount_value, valid_until)
 *   - Primary "Apply" CTA → affiliate redirect
 *   - Secondary "View review" → `/cards/{slug}`
 *
 * Empty-state (no ranked cards): renders `noPromosLabel` and returns
 * the base earn-rate fallback list (caller drops in a friendly note).
 */

export interface RankedCardListProps {
  ranked: MerchantRankedCard[];
  merchantDisplayName: string;
  /** Translated label: "ยังไม่มีโปรโมชันพิเศษตอนนี้ ..." */
  noPromosLabel?: string;
  /** Number of rows to render (top N). Default: 5. */
  limit?: number;
}

export function RankedCardList({
  ranked,
  merchantDisplayName,
  noPromosLabel,
  limit = 5,
}: RankedCardListProps) {
  if (ranked.length === 0) {
    return (
      <p className="text-body-sm text-loftly-ink-muted">
        {noPromosLabel ??
          'ยังไม่มีโปรโมชันพิเศษตอนนี้ — บัตรเหล่านี้ให้คะแนนฐานสูงสุด'}
      </p>
    );
  }

  const rows = ranked.slice(0, limit);

  return (
    <ol className="flex flex-col gap-4" data-testid="merchant-ranked-list">
      {rows.map((row, idx) => (
        <li key={row.card_slug}>
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>
                    <span className="mr-2 rounded-full bg-loftly-ink px-2 py-0.5 text-caption text-white">
                      #{idx + 1}
                    </span>
                    {row.display_name}
                  </CardTitle>
                  {row.bank_display_name_th && (
                    <p className="text-caption text-loftly-ink-muted">
                      {row.bank_display_name_th}
                    </p>
                  )}
                </div>
                {row.user_owns && (
                  <Badge variant="teal">คุณมีบัตรนี้</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3 text-body-sm">
              <div className="rounded-md bg-loftly-teal-soft p-3 text-loftly-teal">
                <p className="text-caption font-medium uppercase tracking-wide">
                  ประมาณการมูลค่า
                </p>
                <p className="mt-0.5 font-mono text-numeric-table font-semibold">
                  ได้ประมาณ ~฿
                  {new Intl.NumberFormat('th-TH', {
                    maximumFractionDigits: 0,
                  }).format(row.est_value_per_1000_thb)}{' '}
                  ต่อ ฿1,000 ที่ใช้จ่ายที่ {merchantDisplayName}
                </p>
                {row.confidence === 0 && (
                  <p className="mt-1 text-caption text-loftly-teal-hover">
                    (base-earn เท่านั้น — ยังไม่มี valuation)
                  </p>
                )}
              </div>

              {row.applicable_promos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {row.applicable_promos.map((p) => (
                    <Badge key={p.id} variant="outline" className="text-xs">
                      {p.title_th}
                      {p.discount_value ? ` · ${p.discount_value}` : ''}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-2">
              <div className="flex items-center gap-2">
                {row.affiliate_apply_url && (
                  <Button asChild className="flex-1">
                    <a
                      href={row.affiliate_apply_url}
                      rel="sponsored nofollow"
                    >
                      สมัครผ่าน Loftly
                    </a>
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href={`/cards/${row.card_slug}`}>ดูรีวิว</Link>
                </Button>
              </div>
              <AffiliateDisclosure variant="inline" />
            </CardFooter>
          </Card>
        </li>
      ))}
    </ol>
  );
}

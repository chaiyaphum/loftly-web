import { Badge } from '@/components/ui/badge';
import type { MerchantCanonical } from '@/lib/api/merchants';

/**
 * MerchantPageHeader — hero for `/merchants/[slug]`.
 *
 * Renders:
 *   - Optional logo (CDN path from `logo_url`, lazy-loaded <img>)
 *   - Bilingual display names (Thai primary as H1, English secondary)
 *   - Category + merchant-type badges
 *   - Active promo count (passed in since ranked_cards lives one level up)
 */

export interface MerchantPageHeaderProps {
  merchant: MerchantCanonical;
  activePromoCount: number;
}

const TYPE_LABEL_TH: Record<string, string> = {
  retail: 'ค้าปลีก',
  fnb: 'ร้านอาหาร',
  ecommerce: 'อีคอมเมิร์ซ',
  travel: 'ท่องเที่ยว',
  service: 'บริการ',
};

export function MerchantPageHeader({
  merchant,
  activePromoCount,
}: MerchantPageHeaderProps) {
  const typeLabel =
    TYPE_LABEL_TH[merchant.merchant_type] ?? merchant.merchant_type;

  return (
    <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      {merchant.logo_url && (
        // Brand logos; sourced from admin CMS. Next/Image is skipped so CDN
        // paths without explicit width/height still render without layout
        // shift warnings in the dev console.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={merchant.logo_url}
          alt={`${merchant.display_name_en} logo`}
          width={64}
          height={64}
          className="h-16 w-16 rounded-md border border-slate-200 object-contain"
        />
      )}

      <div className="flex-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {merchant.display_name_th}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {merchant.display_name_en}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{typeLabel}</Badge>
          {merchant.category_default && (
            <Badge variant="outline">{merchant.category_default}</Badge>
          )}
          {activePromoCount > 0 && (
            <Badge variant="success">
              {activePromoCount} โปรโมชันที่ใช้งานได้
            </Badge>
          )}
        </div>

        {merchant.description_th && (
          <p className="mt-4 max-w-prose text-sm text-slate-700">
            {merchant.description_th}
          </p>
        )}
      </div>
    </header>
  );
}

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { listMerchants, type MerchantListItem } from '@/lib/api/merchants';

/**
 * SimilarMerchants — fallback list for zero-result searches and empty pages.
 *
 * Server component: hits `/v1/merchants` filtered by the seed category of
 * the hinted merchant (if any) or falls back to category=null. Renders the
 * top-5 alphabetical neighbours as a simple grid.
 *
 * Trigger points:
 *   - `/merchants` hub, below the A-Z rail (when no category is active).
 *   - 404 page for `/merchants/[slug]` when the slug doesn't resolve.
 *   - Landing-page search bar with zero matches (optional render).
 *
 * Failures are swallowed — the component returns `null` rather than
 * exploding the parent page.
 */

export interface SimilarMerchantsProps {
  category?: string;
  limit?: number;
  heading?: string;
}

export async function SimilarMerchants({
  category,
  limit = 5,
  heading = 'ร้านค้าที่คล้ายกัน',
}: SimilarMerchantsProps) {
  let items: MerchantListItem[] = [];
  try {
    const response = await listMerchants({ category });
    items = response.data.slice(0, limit);
  } catch {
    return null;
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-slate-700">{heading}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/merchants/${m.slug}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <span className="font-medium">{m.display_name_th}</span>
              {m.active_promo_count > 0 && (
                <Badge variant="outline" className="text-xs">
                  {m.active_promo_count}
                </Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

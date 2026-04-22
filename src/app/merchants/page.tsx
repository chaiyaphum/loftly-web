import type { Metadata } from 'next';
import Link from 'next/link';
import { listMerchants, type MerchantListItem } from '@/lib/api/merchants';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { Badge } from '@/components/ui/badge';
import { MerchantSearchBar } from '@/components/merchants/MerchantSearchBar';

/**
 * `/merchants` — browse hub.
 *
 * SSG with a 1-hour revalidate; each category/letter filter combo renders
 * a fresh page through ISR on demand. Primary entry points:
 *   - Deep link from blog/SEO backlinks.
 *   - Landing-page CTA bounce when the user bails on the primary Selector.
 *   - Post-404 rescue: `/merchants/[unknown]` 404 copy links back here.
 */

export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: 'ค้นหาร้านค้า',
  description:
    'เปรียบเทียบบัตรเครดิตสำหรับแต่ละร้านค้า — Starbucks, Grab, Shopee และอื่น ๆ ที่ Loftly',
  path: '/merchants',
});

const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
];

async function fetchAll(): Promise<MerchantListItem[]> {
  try {
    const response = await listMerchants({});
    return response.data;
  } catch {
    return [];
  }
}

function groupByLetter(items: MerchantListItem[]): Record<string, MerchantListItem[]> {
  const groups: Record<string, MerchantListItem[]> = {};
  for (const m of items) {
    const letter = (m.display_name_en.charAt(0) || '#').toUpperCase();
    (groups[letter] ??= []).push(m);
  }
  for (const key of Object.keys(groups)) {
    const bucket = groups[key];
    if (bucket) {
      bucket.sort((a, b) =>
        a.display_name_en.localeCompare(b.display_name_en),
      );
    }
  }
  return groups;
}

export default async function MerchantsHubPage() {
  const items = await fetchAll();
  const grouped = groupByLetter(items);
  const activeLetters = new Set(Object.keys(grouped));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          ค้นหาร้านค้า
        </h1>
        <p className="mt-2 text-sm text-loftly-ink-muted">
          เปรียบเทียบบัตรเครดิตที่ดีที่สุดสำหรับแต่ละร้าน
        </p>
      </header>

      <div className="mb-10">
        <MerchantSearchBar variant="full" />
      </div>

      {/* A–Z rail */}
      <nav
        aria-label="A–Z merchants"
        className="mb-6 flex flex-wrap gap-1 text-xs"
      >
        {LETTERS.map((l) => (
          <a
            key={l}
            href={`#letter-${l}`}
            className={`rounded px-2 py-1 font-mono ${
              activeLetters.has(l)
                ? 'text-loftly-ink hover:bg-loftly-divider/50'
                : 'text-slate-300'
            }`}
            aria-disabled={!activeLetters.has(l)}
          >
            {l}
          </a>
        ))}
      </nav>

      {items.length === 0 && (
        <p className="text-sm text-loftly-ink-muted">
          ยังไม่มีข้อมูลร้านค้าในขณะนี้ — กำลังอัปเดต
        </p>
      )}

      <div className="flex flex-col gap-10">
        {Object.keys(grouped)
          .sort()
          .map((letter) => (
            <section key={letter} id={`letter-${letter}`}>
              <h2 className="mb-3 text-lg font-semibold">{letter}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(grouped[letter] ?? []).map((m) => (
                  <li key={m.slug}>
                    <Link
                      href={`/merchants/${m.slug}`}
                      className="flex items-center justify-between rounded-md border border-loftly-divider px-3 py-2 hover:border-slate-400"
                    >
                      <div>
                        <p className="font-medium">{m.display_name_th}</p>
                        <p className="text-xs text-loftly-ink-muted">
                          {m.display_name_en}
                        </p>
                      </div>
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
          ))}
      </div>
    </main>
  );
}

import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

/**
 * TopMerchantsGrid — quick-link chips to popular Thai merchants (brief
 * §15.3 section 2). Static seed list for now since the "featured"
 * endpoint isn't exposed yet; swap to API data when ready.
 */

type SeedMerchant = { slug: string; name: string; nameTh?: string };

/**
 * Slugs below are aligned to the backend-seeded canonical merchant slugs
 * (see `/v1/merchants?limit=100` on staging, 50 entries). Names/nameTh
 * are frontend display labels — the backend may use slightly different
 * display names, but slug is the linking contract.
 */
const SEED: SeedMerchant[] = [
  { slug: 'starbucks', name: 'Starbucks', nameTh: 'สตาร์บัคส์' },
  { slug: 'grab-food', name: 'GrabFood', nameTh: 'แกร็บฟู้ด' },
  { slug: 'shopee', name: 'Shopee', nameTh: 'ช้อปปี้' },
  { slug: 'lazada', name: 'Lazada', nameTh: 'ลาซาด้า' },
  { slug: 'seven-eleven', name: '7-Eleven', nameTh: 'เซเว่น-อีเลฟเว่น' },
  { slug: 'central-department-store', name: 'Central', nameTh: 'เซ็นทรัล' },
  { slug: 'siam-paragon', name: 'Siam Paragon', nameTh: 'สยามพารากอน' },
  { slug: 'agoda', name: 'Agoda', nameTh: 'อโกด้า' },
  { slug: 'foodpanda', name: 'Foodpanda', nameTh: 'ฟู้ดแพนด้า' },
  { slug: 'mcdonalds', name: "McDonald's", nameTh: 'แมคโดนัลด์' },
  { slug: 'bts', name: 'BTS' },
  { slug: 'tops-supermarket', name: 'Tops', nameTh: 'ท็อปส์' },
  { slug: 'big-c', name: 'Big C', nameTh: 'บิ๊กซี' },
  { slug: 'robinson', name: 'Robinson', nameTh: 'โรบินสัน' },
  { slug: 'the-mall', name: 'The Mall', nameTh: 'เดอะมอลล์' },
  { slug: 'emporium', name: 'Emporium', nameTh: 'เอ็มโพเรียม' },
  { slug: 'amazon-cafe', name: 'Café Amazon', nameTh: 'คาเฟ่ อเมซอน' },
  { slug: 'makro', name: 'Makro', nameTh: 'แม็คโคร' },
  { slug: 'booking-com', name: 'Booking.com' },
  { slug: 'uniqlo-thailand', name: 'UNIQLO', nameTh: 'ยูนิโคล่' },
];

export async function TopMerchantsGrid() {
  const t = await getTranslations('landing');

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="top-merchants-heading"
    >
      <div className="flex items-end justify-between">
        <h2
          id="top-merchants-heading"
          className="text-heading-lg text-loftly-ink"
        >
          {t('topMerchantsTitle')}
        </h2>
        <Link
          href="/merchants"
          className="text-body-sm font-medium text-loftly-teal hover:text-loftly-teal-hover"
        >
          {t('topMerchantsBrowse')} →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {SEED.map((m) => (
          <li key={m.slug}>
            <Link
              href={`/merchants/${m.slug}`}
              className="flex h-full min-w-0 items-center justify-between gap-2 rounded-md border border-loftly-divider bg-loftly-surface px-4 py-3 text-body-sm text-loftly-ink transition-colors hover:border-loftly-teal hover:bg-loftly-teal-soft hover:text-loftly-teal"
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{m.name}</span>
                {m.nameTh ? (
                  <span className="ml-1 text-caption text-loftly-ink-muted">
                    · {m.nameTh}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className="ml-2 text-loftly-ink-muted group-hover:text-loftly-teal"
              >
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

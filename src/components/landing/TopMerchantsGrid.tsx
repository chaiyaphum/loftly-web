import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

/**
 * TopMerchantsGrid — quick-link chips to popular Thai merchants (brief
 * §15.3 section 2). Static seed list for now since the "featured"
 * endpoint isn't exposed yet; swap to API data when ready.
 */

type SeedMerchant = { slug: string; name: string; nameTh?: string };

const SEED: SeedMerchant[] = [
  { slug: 'starbucks', name: 'Starbucks' },
  { slug: 'grab', name: 'Grab' },
  { slug: 'shopee', name: 'Shopee' },
  { slug: 'lazada', name: 'Lazada' },
  { slug: '7-eleven', name: '7-Eleven', nameTh: 'เซเว่น-อีเลฟเว่น' },
  { slug: 'central', name: 'Central', nameTh: 'เซ็นทรัล' },
  { slug: 'siam-paragon', name: 'Siam Paragon' },
  { slug: 'agoda', name: 'Agoda' },
  { slug: 'foodpanda', name: 'Foodpanda' },
  { slug: 'line-man', name: 'LINE MAN' },
  { slug: 'bts', name: 'BTS' },
  { slug: 'tops', name: 'Tops', nameTh: 'ท็อปส์' },
  { slug: 'bigc', name: 'Big C', nameTh: 'บิ๊กซี' },
  { slug: 'robinson', name: 'Robinson', nameTh: 'โรบินสัน' },
  { slug: 'the-mall', name: 'The Mall', nameTh: 'เดอะมอลล์' },
  { slug: 'emquartier', name: 'EmQuartier' },
  { slug: 'cafe-amazon', name: 'Café Amazon' },
  { slug: 'makro', name: 'Makro', nameTh: 'แม็คโคร' },
  { slug: 'king-power', name: 'King Power' },
  { slug: 'booking', name: 'Booking.com' },
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

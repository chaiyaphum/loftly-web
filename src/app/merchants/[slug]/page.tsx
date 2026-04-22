import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buildPageMetadata, SITE_URL } from '@/lib/seo/metadata';
import { getMerchantPage } from '@/lib/api/merchants';
import { LoftlyAPIError } from '@/lib/api/client';
import { MerchantPageHeader } from '@/components/merchants/MerchantPageHeader';
import { RankedCardList } from '@/components/merchants/RankedCardList';
import { MerchantJsonLd } from '@/components/merchants/MerchantJsonLd';
import { SimilarMerchants } from '@/components/merchants/SimilarMerchants';

/**
 * `/merchants/[slug]` — the Merchant Reverse Lookup surface.
 *
 * SSR + ISR (300s revalidate). This is the page that has to win against
 * AI Overviews — the numbers, rules, and promos we render HERE are what
 * Risk 1 mitigation looks like in code. See `mvp/POST_V1.md §9` for the
 * product bet.
 *
 * Layout:
 *   - Breadcrumb (Home → Merchants → Name)
 *   - MerchantPageHeader (hero: logo, bilingual names, badges)
 *   - RankedCardList (top-5 cards × applicable promos × est value)
 *   - SimilarMerchants (bottom rail)
 *   - MerchantJsonLd (Schema.org LocalBusiness / OnlineStore + ItemList)
 *
 * 404 behavior: `notFound()` → the project's global `not-found.tsx`.
 */

export const revalidate = 300;

type PageParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await getMerchantPage(slug);
    const m = data.merchant;
    const path = `/merchants/${slug}`;
    const titleTh = `บัตรไหนดีที่ ${m.display_name_th}? | Loftly`;
    const titleEn = `Best credit cards at ${m.display_name_en} | Loftly`;
    const description =
      m.description_th ??
      m.description_en ??
      `เปรียบเทียบบัตรเครดิตทุกใบ + โปรโมชันที่ active ที่ ${m.display_name_th}`;

    const base = buildPageMetadata({
      title: titleTh,
      description,
      path,
      ogType: 'website',
      // Static placeholder; dynamic Satori-rendered OG is a W+1 nice-to-have.
      ogImage: '/og-default.png',
    });

    return {
      ...base,
      alternates: {
        ...base.alternates,
        canonical: `${SITE_URL}${path}`,
        languages: {
          'th-TH': `${SITE_URL}${path}`,
          'en-US': `${SITE_URL}/en${path}`,
          'x-default': `${SITE_URL}${path}`,
        },
      },
      // Mirror the English title onto OG for the `en` locale variant.
      openGraph: {
        ...(base.openGraph ?? {}),
        title: titleEn,
      },
    };
  } catch {
    return buildPageMetadata({
      title: 'Merchant',
      path: `/merchants/${slug}`,
    });
  }
}

export default async function MerchantDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { slug } = await params;

  try {
    const data = await getMerchantPage(slug);
    const { merchant, ranked_cards: ranked } = data;
    const merchantName = merchant.display_name_th;
    const activePromoCount = ranked.reduce(
      (acc, row) => acc + row.applicable_promos.length,
      0,
    );

    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <MerchantJsonLd
          merchant={merchant}
          ranked={ranked}
          canonicalUrl={data.canonical_url}
        />

        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-loftly-ink-muted">
          <Link href="/" className="hover:underline">
            หน้าแรก
          </Link>
          <span className="mx-1">/</span>
          <Link href="/merchants" className="hover:underline">
            ร้านค้า
          </Link>
          <span className="mx-1">/</span>
          <span>{merchant.display_name_th}</span>
        </nav>

        <MerchantPageHeader
          merchant={merchant}
          activePromoCount={activePromoCount}
        />

        {/* Ranked cards */}
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            บัตรไหนดีที่ {merchantName}?
          </h2>
          <p className="mb-4 text-sm text-loftly-ink-muted">
            เปรียบเทียบบัตรเครดิตทุกใบ + โปรโมชันที่ active ที่{' '}
            {merchantName}
          </p>
          <RankedCardList
            ranked={ranked}
            merchantDisplayName={merchantName}
          />
        </section>

        {/* Similar merchants */}
        <SimilarMerchants
          category={merchant.category_default ?? undefined}
          heading="ร้านค้าใกล้เคียง"
        />

        <p className="mt-8 text-xs text-loftly-ink-muted/70">
          อัปเดต:{' '}
          {new Date(data.generated_at).toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </main>
    );
  } catch (err) {
    // 404 → hard miss, show branded not-found.
    // status 0 (network error / timeout — `fetch` never got a structured
    // response) → also treat as not-found so we don't serve a raw 500 when
    // the backend is unreachable. Anything else (5xx, unexpected 4xx) is
    // rethrown so the scoped `error.tsx` boundary can render a retry UI.
    if (err instanceof LoftlyAPIError && (err.status === 404 || err.status === 0)) {
      notFound();
    }
    throw err;
  }
}

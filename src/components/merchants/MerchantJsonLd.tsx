import type {
  MerchantCanonical,
  MerchantRankedCard,
} from '@/lib/api/merchants';

/**
 * MerchantJsonLd — emits Schema.org JSON-LD for `/merchants/[slug]`.
 *
 * Three blobs serialized into one <script>:
 *   1. Main entity — LocalBusiness (retail/fnb/travel/service) OR
 *      OnlineStore (ecommerce). Drives rich results on Google.
 *   2. ItemList — the top-5 ranked cards as Offer entries. This is the
 *      Risk 1 mitigation surface — AI Overviews that cite our JSON-LD
 *      will attribute to us.
 *   3. BreadcrumbList — Home → Merchants → {Name}.
 *
 * Emission is inlined via `dangerouslySetInnerHTML` so Next.js ships
 * the markup statically with no hydration cost.
 */

export interface MerchantJsonLdProps {
  merchant: MerchantCanonical;
  ranked: MerchantRankedCard[];
  canonicalUrl: string;
}

function mainEntityType(merchant: MerchantCanonical): string {
  // ecommerce → OnlineStore; all others → LocalBusiness.
  if (merchant.merchant_type === 'ecommerce') return 'OnlineStore';
  return 'LocalBusiness';
}

function buildMainEntity(
  merchant: MerchantCanonical,
  canonicalUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': mainEntityType(merchant),
    '@id': canonicalUrl,
    name: merchant.display_name_en,
    alternateName: merchant.display_name_th,
    url: canonicalUrl,
    image: merchant.logo_url ?? undefined,
    description:
      merchant.description_en ??
      merchant.description_th ??
      `Credit card rewards at ${merchant.display_name_en}.`,
  };
}

function buildItemList(
  ranked: MerchantRankedCard[],
  merchant: MerchantCanonical,
  canonicalUrl: string,
): Record<string, unknown> {
  const top = ranked.slice(0, 5);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Best credit cards at ${merchant.display_name_en}`,
    url: canonicalUrl,
    numberOfItems: top.length,
    itemListElement: top.map((row, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Offer',
        name: row.display_name,
        category: 'Credit Card',
        url: `https://loftly.co.th/cards/${row.card_slug}`,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: row.est_value_per_1000_thb,
          priceCurrency: 'THB',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1000,
            unitCode: 'THB',
          },
        },
      },
    })),
  };
}

function buildBreadcrumbList(
  merchant: MerchantCanonical,
  canonicalUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Loftly',
        item: 'https://loftly.co.th/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Merchants',
        item: 'https://loftly.co.th/merchants',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: merchant.display_name_en,
        item: canonicalUrl,
      },
    ],
  };
}

export function MerchantJsonLd({
  merchant,
  ranked,
  canonicalUrl,
}: MerchantJsonLdProps) {
  // A graph with all three entities — render-once JSON, no runtime cost.
  const graph = [
    buildMainEntity(merchant, canonicalUrl),
    buildItemList(ranked, merchant, canonicalUrl),
    buildBreadcrumbList(merchant, canonicalUrl),
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCard } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CardEarnRateTable } from '@/components/loftly/CardEarnRateTable';
import { CardCompareWidget } from '@/components/loftly/CardCompareWidget';
import { AffiliateDisclosure } from '@/components/loftly/AffiliateDisclosure';
import { ThaiNumberFormat } from '@/components/loftly/ThaiNumberFormat';
import type { Card as CardT } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

/**
 * `/cards/[slug]` review page — follows WF-4 + UI_CONTENT.md §Card review
 * template sections 1–10. Sections 11 (FAQ) and 12 (Related cards) render as
 * placeholder blocks for now; the editorial pipeline fills them in Month 2+.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const card = await getCard(slug);
    const title = `${card.display_name} — ${card.bank.display_name_en}`;
    const description =
      card.description_en ??
      card.description_th ??
      `Review of ${card.display_name} by Loftly.`;
    return buildPageMetadata({
      title,
      description,
      path: `/cards/${slug}`,
      // Per-card dynamic OG image is a Phase 2 deliverable — see DEV_PLAN
      // W13 ("flag as future — use static default for now").
      // ogImage: `/api/og/card/${slug}.png`,
      ogType: 'article',
    });
  } catch {
    return buildPageMetadata({
      title: 'Card review',
      path: `/cards/${slug}`,
    });
  }
}

function buildJsonLd(card: CardT, updatedAt: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'Product',
      name: card.display_name,
      brand: card.bank.display_name_en,
      category: 'Credit Card',
    },
    author: {
      '@type': 'Organization',
      name: 'Loftly',
      url: 'https://loftly.co.th',
    },
    datePublished: updatedAt,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: '4.2',
      bestRating: '5',
    },
  };
}

export default async function CardReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations('cards');
  const tc = await getTranslations('common');

  let card: CardT;
  try {
    card = await getCard(slug);
  } catch (err) {
    if (err instanceof LoftlyAPIError && err.status === 404) {
      notFound();
    }
    console.error('[cards/[slug]] getCard failed', err);
    throw err;
  }

  const updatedAt = new Date().toISOString();
  const rawSections = t.raw('reviewSections') as Record<string, string>;
  const sections = (key: string): string => rawSections[key] ?? '';

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(card, updatedAt)),
        }}
      />

      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/cards" className="hover:underline">
          {t('indexTitle')}
        </Link>
        <span className="mx-1">/</span>
        <span>{card.display_name}</span>
      </nav>

      {/* Section 1 · Hero */}
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {card.display_name}
        </h1>
        <p className="text-sm text-slate-500">
          {t('reviewTitle')} ·{' '}
          {tc('updatedAt', {
            date: new Date(updatedAt).toLocaleDateString('th-TH'),
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{card.bank.display_name_th}</Badge>
          <Badge variant="outline">{card.network}</Badge>
          {card.tier && <Badge variant="outline">{card.tier}</Badge>}
          <Badge variant="success">
            {card.earn_currency.display_name_en}
          </Badge>
        </div>
      </header>

      <Separator className="my-6" />

      <div className="grid gap-3 rounded-md border border-slate-200 p-4 text-sm sm:grid-cols-2">
        {card.annual_fee_thb !== null && card.annual_fee_thb !== undefined && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {tc('annualFee')}
            </dt>
            <dd className="font-medium">
              <ThaiNumberFormat value={card.annual_fee_thb} />
              {card.annual_fee_waiver && (
                <span className="ml-1 text-slate-500">
                  ({card.annual_fee_waiver})
                </span>
              )}
            </dd>
          </div>
        )}
        {card.min_income_thb !== null && card.min_income_thb !== undefined && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {tc('minIncome')}
            </dt>
            <dd className="font-medium">
              <ThaiNumberFormat value={card.min_income_thb} />{' '}
              <span className="text-slate-500">/ {tc('perMonth')}</span>
            </dd>
          </div>
        )}
      </div>

      <div className="my-6 flex flex-col items-start gap-2">
        <Button asChild size="lg">
          <a href={`/apply/${card.id}`} rel="sponsored nofollow">
            {t('applyPrimaryCta')}
          </a>
        </Button>
        <AffiliateDisclosure variant="inline" />
      </div>

      <Separator className="my-8" />

      {/* Section 2 · Who's it for */}
      <Section title={sections('whoFor')}>
        <p className="text-sm text-slate-700">
          {card.description_th ?? card.description_en ?? '—'}
        </p>
      </Section>

      {/* Section 3 · Loftly score */}
      <Section title={sections('score')}>
        <p className="text-sm text-slate-700">
          <span className="text-2xl font-semibold tabular-nums">4.2</span>
          <span className="ml-2 text-slate-500">/ 5</span>
        </p>
      </Section>

      {/* Section 4 · Earn rate table */}
      <Section title={sections('earnRates')}>
        <CardEarnRateTable
          earn_rate_local={card.earn_rate_local}
          earn_rate_foreign={card.earn_rate_foreign}
        />
      </Section>

      {/* Section 5 · Valuation snapshot */}
      <Section title={sections('valuation')}>
        <p className="text-sm text-slate-600">
          {t('noValuation')}
        </p>
      </Section>

      {/* Section 6 · Benefits */}
      <Section title={sections('benefits')}>
        {Object.keys(card.benefits ?? {}).length === 0 ? (
          <p className="text-sm text-slate-500">—</p>
        ) : (
          <ul className="list-disc space-y-1 pl-6 text-sm text-slate-700">
            {Object.entries(card.benefits).map(([key, val]) => (
              <li key={key}>
                <span className="font-medium capitalize">{key}</span>:{' '}
                <span>
                  {typeof val === 'string' ? val : JSON.stringify(val)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* W17 · Compare widget — slotted between Benefits and Current promotions
          per mvp/UI_CONTENT.md §Card review template. Accordion collapsed by
          default; widget lazy-fetches similar cards on first expand. */}
      <div className="mb-8">
        <CardCompareWidget
          sourceSlug={card.slug}
          sourceDisplayName={card.display_name}
        />
      </div>

      {/* Section 7 · Promotions (placeholder) */}
      <Section title={sections('promos')}>
        <p className="text-sm text-slate-500">—</p>
      </Section>

      {/* Section 8 · Fees & conditions */}
      <Section title={sections('fees')}>
        <ul className="list-disc space-y-1 pl-6 text-sm text-slate-700">
          {card.annual_fee_thb !== null && card.annual_fee_thb !== undefined && (
            <li>
              {tc('annualFee')}: <ThaiNumberFormat value={card.annual_fee_thb} />
              {card.annual_fee_waiver && (
                <span className="text-slate-500">
                  {' '}
                  ({card.annual_fee_waiver})
                </span>
              )}
            </li>
          )}
          {card.min_income_thb !== null &&
            card.min_income_thb !== undefined && (
              <li>
                {tc('minIncome')}:{' '}
                <ThaiNumberFormat value={card.min_income_thb} /> /{' '}
                {tc('perMonth')}
              </li>
            )}
          {card.min_age !== null && card.min_age !== undefined && (
            <li>Min age: {card.min_age}</li>
          )}
        </ul>
      </Section>

      {/* Section 9 · How to apply */}
      <Section title={sections('apply')}>
        <p className="text-sm text-slate-700">
          {t('applyCta')}
        </p>
        <div className="mt-3">
          <Button asChild>
            <a href={`/apply/${card.id}`} rel="sponsored nofollow">
              {t('applyPrimaryCta')}
            </a>
          </Button>
        </div>
        <div className="mt-3">
          <AffiliateDisclosure variant="inline" />
        </div>
      </Section>

      {/* Section 10 · Bottom line */}
      <Section title={sections('bottomLine')}>
        <p className="text-sm text-slate-700">
          {card.description_th ?? card.description_en ?? '—'}
        </p>
      </Section>

      {/* Section 11 · FAQ placeholder */}
      <Section title={sections('faq')}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">—</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            {t('disclaimer')}
          </CardContent>
        </Card>
      </Section>

      {/* Section 12 · Related cards placeholder */}
      <Section title={sections('related')}>
        <p className="text-sm text-slate-500">—</p>
      </Section>

      <Separator className="my-8" />
      <AffiliateDisclosure variant="footer" />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

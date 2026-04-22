import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { getApiBase } from '@/lib/api/client';

/**
 * FeaturedCards — editorial cards carousel (design_handoff §Component 5).
 * Gradient card-art per issuer, tabular-num BASE rate + FEE on the footer,
 * tagline line-clamped for consistent card height.
 */

type ApiCard = {
  id: string;
  slug: string;
  display_name: string;
  bank?: { display_name_en?: string | null; display_name_th?: string | null } | null;
  network?: string | null;
  tier?: string | null;
  annual_fee_thb?: number | null;
  earn_rate_local?: number | null;
  description_th?: string | null;
  description_en?: string | null;
  color?: string | null;
};

// Canonical brand-ish gradient fallbacks per issuer (used when the card
// payload doesn't carry a `color`).
const ISSUER_GRADIENT: Record<string, string> = {
  UOB: '#0B3B8C',
  KBank: '#0E7C5B',
  KTC: '#E03A3E',
  'CardX / SCB': '#6B2C8C',
  SCB: '#6B2C8C',
  'Krungsri (BAY)': '#CC9F2A',
  'Bangkok Bank': '#1E2A3A',
  Citi: '#003B70',
};

function gradientFor(card: ApiCard): string {
  if (card.color) return card.color;
  const issuer = card.bank?.display_name_en ?? '';
  return ISSUER_GRADIENT[issuer] ?? '#1E2A3A';
}

async function fetchFeaturedCards(): Promise<ApiCard[]> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/cards?limit=4`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: ApiCard[] };
    return (body.data ?? []).slice(0, 4);
  } catch {
    return [];
  }
}

export async function FeaturedCards() {
  const [cards, t] = await Promise.all([
    fetchFeaturedCards(),
    getTranslations('landing.featured'),
  ]);

  if (cards.length === 0) return null;

  return (
    <section
      className="border-y border-loftly-divider bg-loftly-surface px-4 py-20 md:px-6"
      aria-labelledby="featured-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-caption font-semibold uppercase tracking-[0.08em] text-loftly-teal">
              {t('eyebrow')}
            </p>
            <h2
              id="featured-heading"
              className="text-loftly-ink"
              style={{
                fontSize: 'clamp(28px, 3.5vw, 40px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
              }}
            >
              {t('heading')}
            </h2>
            <p className="mt-1.5 max-w-lg text-body text-loftly-ink-muted">
              {t('subheading')}
            </p>
          </div>
          <Link
            href="/cards"
            className="inline-flex h-10 items-center gap-1 rounded-md border border-loftly-divider-strong bg-loftly-surface px-4 text-body-sm font-medium text-loftly-ink transition-colors hover:border-loftly-teal hover:text-loftly-teal"
          >
            {t('allReviews')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const color = gradientFor(card);
            const fee =
              typeof card.annual_fee_thb === 'number' && card.annual_fee_thb > 0
                ? `฿${card.annual_fee_thb.toLocaleString('en-US')}`
                : t('feeFree');
            const rate =
              typeof card.earn_rate_local === 'number'
                ? `${card.earn_rate_local}×`
                : '—';
            const tagline =
              card.description_th ?? card.description_en ?? '';
            const issuer = card.bank?.display_name_en ?? card.bank?.display_name_th ?? '';
            return (
              <li key={card.id}>
                <Link
                  href={`/cards/${card.slug}`}
                  className="group flex h-full flex-col rounded-[14px] border border-loftly-divider bg-loftly-warm-white p-[18px] transition-all hover:-translate-y-0.5 hover:border-loftly-teal hover:shadow"
                >
                  <div
                    className="flex h-[110px] flex-col justify-between rounded-[10px] p-3.5 text-white"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${color}, ${color}dd)`,
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-85">
                      {issuer}
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold tracking-[-0.01em]">
                        {card.display_name}
                      </p>
                      {card.network ? (
                        <p className="mt-0.5 text-[10px] opacity-75">{card.network}</p>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className="mt-3 text-body-sm text-loftly-ink-muted"
                    style={{ lineHeight: 1.5, minHeight: '2.5rem' }}
                  >
                    <span className="line-clamp-2">{tagline}</span>
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-loftly-divider pt-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-loftly-ink-subtle">
                        {t('baseLabel')}
                      </p>
                      <p className="mt-0.5 font-mono text-[14px] font-semibold text-loftly-ink">
                        {rate}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-loftly-ink-subtle">
                        {t('feeLabel')}
                      </p>
                      <p className="mt-0.5 font-mono text-[14px] font-semibold text-loftly-ink">
                        {fee}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

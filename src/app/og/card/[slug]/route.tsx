import { ImageResponse } from 'next/og';
import { getApiBase } from '@/lib/api/client';
import type { Card } from '@/lib/api/types';

/**
 * `/og/card/[slug]` — Dynamic Open Graph image generator for card reviews.
 *
 * Rendered at the canonical OG size (1200×630) via `next/og`'s `ImageResponse`,
 * which runs on the Edge runtime. This is the image referenced by
 * `<meta property="og:image">` on each `/cards/[slug]` page — replacing the
 * static `/og-default.png` fallback with a card-specific render.
 *
 * Cache: `s-maxage=86400` (1 day at the edge) + `stale-while-revalidate` for a
 * week. The image is visually cheap (no photography, no card artwork) and
 * derived entirely from the cards API payload, so a day-long CDN cache is
 * safe — refreshed eagerly when card metadata changes.
 *
 * Design per PR #23 (OG meta):
 *   - Slate-900 background
 *   - Top-left wordmark "Loftly" + baht-amber accent bar
 *   - Center: display_name (36px), bank + tier + network subtitle (20px)
 *   - Right: valuation snapshot "1 {currency} = {thb} THB" (when present)
 *   - Bottom: "Review โดย Loftly · loftly.co.th"
 *
 * Font strategy: ImageResponse ships Noto Sans / system fallbacks out of the
 * box, which covers both Latin and Thai glyphs. We deliberately don't fetch a
 * custom Thai webfont — keeps the edge bundle small and Thai terms like
 * "Review โดย Loftly" render correctly with the default system stack.
 */

export const runtime = 'edge';

// Brand tokens — kept inline because the Edge runtime can't import the
// Tailwind config, and the numeric literals here match BRAND.md §5 placeholders.
const SLATE_900 = '#0f172a';
const SLATE_300 = '#cbd5e1';
const SLATE_400 = '#94a3b8';
const SLATE_100 = '#f1f5f9';
const BAHT_AMBER = '#ef9f27';
const BAHT_TEAL = '#1d9e75';

const WIDTH = 1200;
const HEIGHT = 630;

const CACHE_HEADER =
  'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';

interface ValuationSnapshot {
  code: string;
  thb_per_point: number;
}

async function fetchCard(slug: string): Promise<Card | null> {
  const base = getApiBase();
  const url = `${base}/cards/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Edge runtime: Next.js honours this for CDN-level caching of upstream.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Card;
  } catch {
    return null;
  }
}

async function fetchValuation(currencyCode: string): Promise<ValuationSnapshot | null> {
  const base = getApiBase();
  const url = `${base}/valuations/${encodeURIComponent(currencyCode)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      currency?: { code?: string };
      thb_per_point?: number;
    };
    if (
      typeof body.thb_per_point !== 'number' ||
      typeof body.currency?.code !== 'string'
    ) {
      return null;
    }
    return { code: body.currency.code, thb_per_point: body.thb_per_point };
  } catch {
    return null;
  }
}

function renderFallbackImage(message: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: SLATE_900,
          color: SLATE_100,
          padding: '64px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '8px',
              height: '48px',
              backgroundColor: BAHT_AMBER,
            }}
          />
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Loftly
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: 48, fontWeight: 600, color: SLATE_100 }}>
            {message}
          </span>
          <span style={{ fontSize: 22, color: SLATE_400 }}>loftly.co.th</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { 'Cache-Control': CACHE_HEADER },
    },
  );
}

function renderCardImage(
  card: Card,
  valuation: ValuationSnapshot | null,
): ImageResponse {
  const subtitleParts = [card.bank.display_name_en];
  if (card.tier) subtitleParts.push(card.tier);
  subtitleParts.push(card.network);
  const subtitle = subtitleParts.join(' · ');

  const thbFormatted = valuation ? valuation.thb_per_point.toFixed(4) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: SLATE_900,
          color: SLATE_100,
          padding: '64px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top row: wordmark + baht-amber accent bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '48px',
              backgroundColor: BAHT_AMBER,
            }}
          />
          <span
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: SLATE_100,
            }}
          >
            Loftly
          </span>
        </div>

        {/* Center row: card title (left) + valuation (right) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '48px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '680px',
            }}
          >
            <span
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: SLATE_100,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              {card.display_name}
            </span>
            <span style={{ fontSize: 24, color: SLATE_300 }}>{subtitle}</span>
          </div>

          {thbFormatted && valuation ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px',
                minWidth: '320px',
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  color: SLATE_400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Valuation
              </span>
              <span
                style={{
                  fontSize: 38,
                  fontWeight: 600,
                  color: BAHT_TEAL,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                1 {valuation.code} = {thbFormatted} THB
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
        </div>

        {/* Bottom row: attribution + URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 22,
            color: SLATE_400,
          }}
        >
          <span>Review โดย Loftly</span>
          <span>loftly.co.th</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { 'Cache-Control': CACHE_HEADER },
    },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;

  const card = await fetchCard(slug);
  if (!card) {
    return renderFallbackImage('Card not found · Loftly');
  }

  // Valuation is a best-effort enrichment — the card image renders without
  // it if the currency lookup fails.
  const valuation = card.earn_currency?.code
    ? await fetchValuation(card.earn_currency.code)
    : null;

  return renderCardImage(card, valuation);
}

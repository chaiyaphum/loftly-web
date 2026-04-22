import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { HeroSearch } from '@/components/landing/HeroSearch';
import { PromoTicker } from '@/components/landing/PromoTicker';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeaturedCards } from '@/components/landing/FeaturedCards';
import { TrustStrip } from '@/components/landing/TrustStrip';

export const dynamic = 'force-static';
export const revalidate = 300;

export const metadata: Metadata = buildPageMetadata({
  title: 'รู้ทันทีว่าใช้บัตรไหนคุ้ม — ที่ทุกร้าน ทุกวัน',
  description:
    'Loftly — live Thai credit-card promo intelligence and merchant-first card recommendations. Know which card wins, at every merchant, every day.',
  path: '/',
});

/**
 * Homepage — V1 Product-first layout
 * (design_handoff_homepage_v1). Section order:
 *
 *   1. HeroSearch     — interactive merchant search + underline SVG accent
 *   2. PromoTicker    — infinite-scroll ticker of expiring promos
 *   3. HowItWorks     — 3 steps with illustrative visuals
 *   4. FeaturedCards  — 4 editorial card-review tiles (gradient art)
 *   5. TrustStrip     — 4 stat blocks (160+ · ฿0.82 · 40+ · 100%)
 *
 * SiteShell wraps this with AppHeader + AppFooter + MobileBottomNav.
 */
export default function LandingPage() {
  return (
    <main>
      <HeroSearch />
      <PromoTicker />
      <HowItWorks />
      <FeaturedCards />
      <TrustStrip />
    </main>
  );
}

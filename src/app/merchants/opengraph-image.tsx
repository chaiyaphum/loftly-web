import { ImageResponse } from 'next/og';

/**
 * Static OG image for `/merchants/*` pages.
 *
 * Minimal ImageResponse today — acceptable because `buildPageMetadata`
 * already points to `/og-default.png` when pages don't override. This
 * file exists so Next.js picks up the dynamic Satori render once the
 * per-merchant data wiring lands in a follow-up PR.
 *
 * Per-merchant dynamic OG (logo + headline + est-value) is called out
 * as a nice-to-have in the workstream spec — tracked separately.
 */

export const runtime = 'edge';
export const alt = 'Loftly — credit card rewards at your favourite merchants';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function MerchantsOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#0f172a,#1e293b)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <p style={{ fontSize: 40, fontWeight: 600, letterSpacing: -0.5 }}>
          Loftly
        </p>
        <p style={{ fontSize: 28, color: '#94a3b8', marginTop: 12 }}>
          บัตรไหนดีที่ร้านโปรดของคุณ?
        </p>
      </div>
    ),
    { ...size },
  );
}

import { type NextRequest } from 'next/server';

// Promo affiliate redirect handler — STUB.
//
// POST_V1 §3 Tier A (2026-04-22) — Promo-Aware Card Selector.
//
// Mirrors the pattern in `src/app/apply/[card_id]/route.ts`. For now this is
// a stub that 302s to a placeholder URL so PromoChip's CTA resolves cleanly
// in dev/staging. Real implementation needs:
//
//   1. A backend endpoint `POST /v1/affiliate/click/promo/{promo_id}` that
//      looks up the promo, writes an `affiliate_clicks` row with
//      `placement='promo'`, and returns the resolved `source_url`.
//   2. This handler reads the resolved URL from that endpoint, appends the
//      standard tracking params, and 302s.
//   3. On any error (404, 5xx, timeout) fall back to
//      `/selector/results/[session_id]` so the user isn't stranded.
//
// Keeping the redirect target deterministic (example.com) so E2E tests don't
// rely on live affiliate infra.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ promo_id: string }> },
) {
  const { promo_id } = await params;
  const target = `https://example.com/promo?id=${encodeURIComponent(promo_id)}`;
  return Response.redirect(target, 302);
}

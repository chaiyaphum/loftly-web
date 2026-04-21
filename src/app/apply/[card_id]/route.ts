import { type NextRequest } from 'next/server';

// Affiliate redirect handler — 302 to partner apply URL.
// Real implementation: look up affiliate_links by card_id, log the click
// (affiliate_clicks table), append tracking params, then redirect.
// For now this is a STUB that redirects to a placeholder URL.
// See SPEC.md §4 "One-tap apply" + API_CONTRACT.md affiliate endpoints.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ card_id: string }> },
) {
  const { card_id } = await params;
  const target = `https://example.com/apply?card=${encodeURIComponent(card_id)}`;
  return Response.redirect(target, 302);
}

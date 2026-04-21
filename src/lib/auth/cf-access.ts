/**
 * Cloudflare Access helpers.
 *
 * CF Access writes `CF-Access-Authenticated-User-Email` and
 * `CF-Access-Jwt-Assertion` to the request headers for every allowlisted user.
 * The gate itself lives at the Cloudflare dashboard — this helper simply reads
 * the header so downstream routes can trust the edge decision.
 *
 * When the user isn't allow-listed, Cloudflare returns a 401 at the edge and
 * the browser never reaches Next.js. The `/gated` page exists for the rare
 * case where an internal 401 bubbles out (e.g. stale cached HTML).
 */

import { headers } from 'next/headers';

export async function getCfAccessEmail(): Promise<string | null> {
  const h = await headers();
  return h.get('cf-access-authenticated-user-email');
}

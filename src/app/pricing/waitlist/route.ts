import { NextRequest, NextResponse } from 'next/server';

/**
 * `/pricing/waitlist` — thin proxy to `POST /v1/waitlist` on loftly-api.
 *
 * Upstream contract (loftly-api#12):
 *   - 201 → new email+source (first-time signup)
 *   - 204 → email already registered for that source (idempotent re-join)
 *   - 422 → invalid email format
 *   - 429 → rate-limited (10/5min/IP)
 *   - 503 → upstream down
 *
 * We forward the real status and additionally return a JSON body with a
 * normalised `status` string the client can switch on without re-deriving it
 * from the HTTP code. Unexpected 5xx responses are logged to the server
 * console — Sentry picks console.error up via its integrations.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WaitlistStatus =
  | 'created'
  | 'exists'
  | 'rate_limited'
  | 'invalid'
  | 'error';

interface WaitlistBody {
  email?: unknown;
  variant?: unknown;
  tier?: unknown;
}

function bodyFor(status: WaitlistStatus) {
  return { status } as const;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json(bodyFor('invalid'), { status: 422 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(bodyFor('invalid'), { status: 422 });
  }

  const variant = typeof body.variant === 'string' ? body.variant : 'unknown';
  const tier = typeof body.tier === 'string' ? body.tier : 'premium';

  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (!apiBase) {
    // No upstream configured — pre-launch dev / preview environment. Treat as
    // a successful signup so the UX test can proceed.
    return NextResponse.json(bodyFor('created'), { status: 201 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase.replace(/\/$/, '')}/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, variant, tier, source: 'pricing' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[pricing/waitlist] upstream fetch failed', err);
    return NextResponse.json(bodyFor('error'), { status: 503 });
  }

  switch (upstream.status) {
    case 201:
      return NextResponse.json(bodyFor('created'), { status: 201 });
    case 204:
      return NextResponse.json(bodyFor('exists'), { status: 200 });
    case 422:
      return NextResponse.json(bodyFor('invalid'), { status: 422 });
    case 429:
      return NextResponse.json(bodyFor('rate_limited'), { status: 429 });
    case 503:
      console.error(
        '[pricing/waitlist] upstream 503 (service unavailable)',
        upstream.status,
      );
      return NextResponse.json(bodyFor('error'), { status: 503 });
    default:
      if (upstream.status >= 500) {
        console.error(
          '[pricing/waitlist] unexpected upstream status',
          upstream.status,
        );
      }
      return NextResponse.json(bodyFor('error'), { status: 502 });
  }
}

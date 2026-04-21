import { NextRequest, NextResponse } from 'next/server';

/**
 * `/api/invite/waitlist-join` — thin proxy to `POST /v1/waitlist` on loftly-api,
 * called from the gated `/invite-required` page when a visitor without a code
 * wants to join the waitlist instead.
 *
 * Mirrors the `/pricing/waitlist` handler (same upstream contract, same
 * `{ status }` body shape) but pins `source=invite_gate` so the admin waitlist
 * viewer can split signups by acquisition surface.
 *
 * Upstream contract (loftly-api#12):
 *   - 201 → new email+source (first-time signup)
 *   - 204 → email already registered for that source (idempotent re-join)
 *   - 422 → invalid email format
 *   - 429 → rate-limited (10/5min/IP)
 *   - 503 → upstream down
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
      body: JSON.stringify({ email, source: 'invite_gate' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[invite/waitlist-join] upstream fetch failed', err);
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
        '[invite/waitlist-join] upstream 503 (service unavailable)',
        upstream.status,
      );
      return NextResponse.json(bodyFor('error'), { status: 503 });
    default:
      if (upstream.status >= 500) {
        console.error(
          '[invite/waitlist-join] unexpected upstream status',
          upstream.status,
        );
      }
      return NextResponse.json(bodyFor('error'), { status: 502 });
  }
}

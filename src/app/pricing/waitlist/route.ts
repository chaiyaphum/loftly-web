import { NextRequest, NextResponse } from 'next/server';

/**
 * `/pricing/waitlist` — stub endpoint for the Phase-1 pricing-interest test.
 *
 * Flow:
 *   1. Validate the posted email (format only; deliverability is irrelevant
 *      until the real waitlist backend ships).
 *   2. Attempt to forward to `POST /v1/waitlist` on the upstream API when
 *      `NEXT_PUBLIC_API_BASE` is set. If the upstream returns a 404/501 or
 *      the request fails we silently swallow the error — the PostHog event
 *      already fired client-side captured the signal we actually care about.
 *   3. Respond 204 so the client shows the success state.
 *
 * TODO wire to /v1/waitlist when endpoint ships — remove the silent-swallow
 * once the upstream exists.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistBody {
  email?: unknown;
  variant?: unknown;
  tier?: unknown;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_email' },
      { status: 400 },
    );
  }

  const variant = typeof body.variant === 'string' ? body.variant : 'unknown';
  const tier = typeof body.tier === 'string' ? body.tier : 'premium';

  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (apiBase) {
    try {
      // TODO wire to /v1/waitlist when endpoint ships — until the upstream
      // endpoint exists the response will be 404/501 and we fall through.
      await fetch(`${apiBase.replace(/\/$/, '')}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, variant, tier, source: 'pricing' }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Silent — the PostHog event already captured the interest signal.
    }
  }

  return new Response(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE,
  hashCode,
  isInviteGateActive,
  isKnownCode,
  readInviteEnv,
  signInvite,
} from '@/lib/invite';

/**
 * `/api/invite` — POST endpoint paired with `/invite-required` form.
 *
 * Accepts JSON `{code: string}` or form-encoded `code=…`, validates against the
 * allowlist, sets `loftly_invite` cookie, redirects (303) to `/`.
 *
 * Edge runtime — middleware.ts skips /api/* so this handler is the single
 * authoritative place for form-based code acceptance.
 */
export const runtime = 'edge';

async function parseCode(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { code?: unknown };
      return typeof body.code === 'string' ? body.code : null;
    }
    if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      const form = await request.formData();
      const raw = form.get('code');
      return typeof raw === 'string' ? raw : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const env = readInviteEnv(process.env);
  if (!isInviteGateActive(env)) {
    // Gate disabled — treat as already-open and redirect home.
    return NextResponse.redirect(new URL('/', request.nextUrl.origin), { status: 303 });
  }

  const code = (await parseCode(request))?.trim() ?? '';
  const accept = request.headers.get('accept') ?? '';
  const wantsJson = accept.includes('application/json');

  if (!code || !isKnownCode(code, env)) {
    const target = new URL('/invite-required', request.nextUrl.origin);
    target.searchParams.set('error', 'invalid');
    if (wantsJson) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 });
    }
    return NextResponse.redirect(target, { status: 303 });
  }

  const cookie = await signInvite(code, env);
  const redirectTarget = new URL('/', request.nextUrl.origin);
  const response = wantsJson
    ? NextResponse.json({ ok: true, code_hash: await hashCode(code) })
    : NextResponse.redirect(redirectTarget, { status: 303 });
  response.cookies.set(INVITE_COOKIE, cookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: INVITE_COOKIE_MAX_AGE,
  });
  return response;
}

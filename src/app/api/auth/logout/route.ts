import { NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  ROLE_COOKIE,
  SESSION_COOKIE,
} from '@/lib/auth/session';

/**
 * `/api/auth/logout` — clears session cookies.
 *
 * We don't call `POST /v1/auth/logout` upstream here because the refresh-token
 * rotation lives in the API client and the cookie is httpOnly; the admin-layout
 * form posts to this route and redirects to `/`.
 */
export const runtime = 'nodejs';

async function handle(request: Request): Promise<NextResponse> {
  const url = new URL('/', new URL(request.url).origin);
  const resp = NextResponse.redirect(url);
  resp.cookies.delete(SESSION_COOKIE);
  resp.cookies.delete(REFRESH_COOKIE);
  resp.cookies.delete(ROLE_COOKIE);
  return resp;
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

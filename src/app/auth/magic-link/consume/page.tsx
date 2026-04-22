import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { consumeMagicLink } from '@/lib/api/auth';
import { LoftlyAPIError } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

/**
 * Magic-link consume landing page.
 *
 * When the user clicks the email link (`.../auth/magic-link/consume?token=…`)
 * we:
 *   1. POST the token to `/v1/auth/magic-link/consume`.
 *   2. Store the returned `access_token` in an HTTP-only `loftly_session`
 *      cookie so subsequent SSR calls (e.g. /selector/results/[id]) can
 *      forward the bearer to the API.
 *   3. Inspect the token payload for a `session_id` claim (base64url-decoded
 *      middle JWT segment) — if present, redirect to the unlocked results.
 *      Else fall back to `/account`.
 *
 * On failure we render a terse retry page — the magic link is single-use and
 * 15-minute TTL per SPEC; real expiry is enforced server-side.
 */
export default async function MagicLinkConsumePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations('auth.magicLink');

  if (!sp.token) {
    return <ExpiredView t={t} />;
  }

  try {
    const pair = await consumeMagicLink(sp.token);

    // HTTP-only, SameSite=Lax, Secure in prod. 15-min max-age matches the
    // access token TTL; refresh flow lives in a later milestone.
    const cookieStore = await cookies();
    cookieStore.set('loftly_session', pair.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.min(pair.expires_in ?? 900, 900),
      path: '/',
    });

    // The magic-link token is signed by the backend; we only need the
    // session_id claim to decide where to send the user. A best-effort
    // base64url decode of the JWT payload is sufficient — we're not
    // trusting it for auth (the cookie is already set), just routing.
    const sessionId = extractSessionIdClaim(sp.token);
    if (sessionId) {
      redirect(`/selector/results/${encodeURIComponent(sessionId)}`);
    }
    redirect('/account');
  } catch (err) {
    // `redirect()` throws internally — re-throw so Next.js handles it.
    if (isNextRedirect(err)) throw err;

    if (err instanceof LoftlyAPIError) {
      return <ExpiredView t={t} detail={err.message_th || err.message_en} />;
    }
    return <ExpiredView t={t} />;
  }
}

function ExpiredView({
  t,
  detail,
}: {
  t: Awaited<ReturnType<typeof getTranslations<'auth.magicLink'>>>;
  detail?: string;
}) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('expiredTitle')}
      </h1>
      <p className="mt-3 text-sm text-loftly-ink-muted">{t('expiredBody')}</p>
      {detail && (
        <p className="mt-2 text-xs text-loftly-ink-muted/70">{detail}</p>
      )}
      <p className="mt-6">
        <Link
          href="/onboarding"
          className="inline-flex items-center rounded-md bg-loftly-teal px-4 py-2 text-sm font-medium text-white hover:bg-loftly-teal/90"
        >
          {t('expiredCta')}
        </Link>
      </p>
    </main>
  );
}

function extractSessionIdClaim(token: string): string | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    const padded = payload + '==='.slice(0, (4 - (payload.length % 4)) % 4);
    const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as { session_id?: unknown };
    return typeof parsed.session_id === 'string' ? parsed.session_id : null;
  } catch {
    return null;
  }
}

function isNextRedirect(err: unknown): boolean {
  // Next.js signals redirect() by throwing a special error with this digest.
  return (
    err !== null &&
    typeof err === 'object' &&
    'digest' in err &&
    typeof (err as { digest?: unknown }).digest === 'string' &&
    ((err as { digest: string }).digest.startsWith('NEXT_REDIRECT'))
  );
}

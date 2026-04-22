import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/auth/session';
import { getMe, type MeProfile } from '@/lib/api/me';
import { LoftlyAPIError } from '@/lib/api/client';
import { AccountCard } from '@/components/account/AccountCard';
import { NOINDEX_METADATA } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'บัญชีของคุณ',
};

/**
 * `/account` — settings landing page tying together the PDPA self-service
 * surfaces:
 *   - `/account/consent`      — PDPA §19 consent toggles
 *   - `/account/data-export`  — PDPA §7 right-to-access
 *   - `/account/delete`       — PDPA §7 right-to-erasure
 *
 * Auth guard: server-side `loftly_session` cookie is required. Unauthed
 * users redirect to `/onboarding?next=/account` to get a magic link.
 *
 * Profile fetch: we pull `/v1/me` to render the user's email, signup date
 * and last login in the hero. The endpoint is not live yet (2026-04-21);
 * `LoftlyAPIError` is swallowed and the hero gracefully falls back to a
 * single "Signed in" label. Once the backend ships this just starts
 * working without a UI change.
 */

function formatIsoDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect('/onboarding?next=/account');
  }

  const t = await getTranslations('account');
  const locale = 'th'; // `next-intl` default — we don't need precise locale here,
  // Intl.DateTimeFormat fallback handles EN nicely too.

  let profile: MeProfile | null = null;
  let profileError = false;
  try {
    profile = await getMe(session.accessToken);
  } catch (err) {
    // 404 / 501 today — degrade gracefully. Other errors are soft-logged.
    if (!(err instanceof LoftlyAPIError)) {
      console.warn('[/account] getMe failed', err);
    }
    profileError = true;
  }

  const signupLabel = formatIsoDate(profile?.created_at, locale);
  const lastLoginLabel = formatIsoDate(profile?.last_login_at, locale);

  return (
    <main
      className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12"
      data-testid="account-landing"
    >
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        {profile?.email ? (
          <dl className="grid gap-3 text-sm text-loftly-ink sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
                {t('hero.email')}
              </dt>
              <dd
                className="mt-0.5 font-medium text-loftly-ink"
                data-testid="account-hero-email"
              >
                {profile.email}
              </dd>
            </div>
            {signupLabel && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
                  {t('hero.since')}
                </dt>
                <dd
                  className="mt-0.5 font-medium text-loftly-ink"
                  data-testid="account-hero-since"
                >
                  {signupLabel}
                </dd>
              </div>
            )}
            {lastLoginLabel && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
                  {t('hero.lastLogin')}
                </dt>
                <dd
                  className="mt-0.5 font-medium text-loftly-ink"
                  data-testid="account-hero-last-login"
                >
                  {lastLoginLabel}
                </dd>
              </div>
            )}
          </dl>
        ) : profileError ? (
          <p
            className="rounded-md border border-amber-200 bg-loftly-amber/15 p-3 text-sm text-loftly-amber-urgent"
            data-testid="account-hero-error"
            role="status"
          >
            {t('loadError')}
          </p>
        ) : null}
      </header>

      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="account-card-grid"
      >
        <AccountCard
          href="/account/consent"
          title={t('cards.consent.title')}
          description={t('cards.consent.desc')}
          cta={t('cards.consent.cta')}
          icon="✓"
          testId="account-card-consent"
        />
        <AccountCard
          href="/account/data-export"
          title={t('cards.dataExport.title')}
          description={t('cards.dataExport.desc')}
          cta={t('cards.dataExport.cta')}
          icon="↓"
          testId="account-card-data-export"
        />
        <AccountCard
          href="/account/delete"
          title={t('cards.delete.title')}
          description={t('cards.delete.desc')}
          cta={t('cards.delete.cta')}
          icon="✕"
          testId="account-card-delete"
          tone="danger"
        />
      </section>

      <footer className="border-t border-loftly-divider pt-6">
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-md border border-loftly-divider bg-white px-4 py-2 text-sm font-medium text-loftly-ink hover:bg-loftly-teal-soft/40"
            data-testid="account-sign-out"
          >
            {t('signOut')}
          </button>
        </form>
      </footer>
    </main>
  );
}

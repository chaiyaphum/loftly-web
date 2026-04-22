import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSelectorResult } from '@/lib/api/selector';
import { getCard } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import { CardResultCard } from '@/components/loftly/CardResultCard';
import { MagicLinkPrompt } from '@/components/loftly/MagicLinkPrompt';
import { PromoChip } from '@/components/loftly/PromoChip';
import { PromoStaleBanner } from '@/components/loftly/PromoStaleBanner';
import { SelectorApplyCtaLabel } from '@/components/loftly/SelectorApplyCtaLabel';
import { StreamingRationale } from '@/components/loftly/StreamingRationale';
import { Badge } from '@/components/ui/badge';
import { NOINDEX_METADATA } from '@/lib/seo/metadata';
import type { Card as CardT, SelectorResult } from '@/lib/api/types';
import { ChatPanel } from './ChatPanel';
import { MobileCollapse } from './MobileCollapse';
import { MobileStickyBar } from './MobileStickyBar';
import { RetryWrapper } from './RetryWrapper';
import { SessionCookieWriter } from './SessionCookieWriter';
import { ShareButton } from './ShareButton';
import { statusToKind } from './ResultsError';

export const dynamic = 'force-dynamic';

// Session-scoped results — must match `/selector/results/*` noindex policy
// in `robots.ts`. Keeps user-specific URLs out of search indexes.
export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'ผลการวิเคราะห์',
};

/**
 * Selector results page (WF-3).
 *
 * SSR flow:
 *   1. Read `session_id` from params + optional `token` from query.
 *   2. Read the session cookie (set by `/auth/magic-link/consume`) if any
 *      so already-authed users skip the email gate.
 *   3. Fetch the SelectorResult. The backend tags `partial_unlock: true` for
 *      anon responses; we use that flag to render the blurred-secondaries UX.
 *   4. Resolve each stack card's full `/cards/{slug}` payload so we can reuse
 *      `CardResultCard` without re-fetching client-side.
 *   5. Render primary card prominently, secondaries blurred behind
 *      `MagicLinkPrompt` when locked, "months to goal" header, AI rationale,
 *      and footer actions (method / reset / save).
 */
export default async function SelectorResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ session_id: string }>;
  searchParams: Promise<{ token?: string; stream?: string }>;
}) {
  const { session_id } = await params;
  const sp = await searchParams;
  const streamEnabled = sp.stream === '1';
  const t = await getTranslations('selector.results');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('loftly_session')?.value ?? null;

  let result: SelectorResult | null = null;
  let errorStatus: number | null = null;
  try {
    result = await getSelectorResult(session_id, sp.token, { accessToken });
  } catch (err) {
    if (err instanceof LoftlyAPIError) {
      errorStatus = err.status;
    } else {
      errorStatus = 0;
    }
  }

  if (!result) {
    // Differentiate by status so the UX matches user intent:
    //   404 → hard miss (unknown session)  — offer new search
    //   410 → expired (24h TTL)            — offer re-run
    //   anything else (5xx, timeout, 0)    — recoverable; show Retry
    return <RetryWrapper kind={statusToKind(errorStatus)} />;
  }

  const stack = result.stack ?? [];
  const primary = stack.find((s) => s.role === 'primary') ?? stack[0];
  const secondaries = stack.filter((s) => s !== primary);
  const locked = Boolean(result.partial_unlock) && !accessToken;

  // Resolve each stack slot to a full Card — silently skip if the fetch fails
  // (card might be archived). The page must still render the rationale.
  const [primaryCard, ...secondaryCards] = await Promise.all(
    [primary, ...secondaries]
      .filter((s): s is NonNullable<typeof primary> => Boolean(s))
      .map(async (slot) => {
        try {
          return await getCard(slot.slug);
        } catch {
          return null;
        }
      }),
  );

  const currency =
    (primary?.monthly_earning_points && primaryCard?.earn_currency.code) ||
    (result.stack[0]?.monthly_earning_points &&
      primaryCard?.earn_currency.code) ||
    '';

  // POST_V1 §3 Tier A (2026-04-22) — Promo-Aware Card Selector.
  // `promo_chips` is the denormalized lookup for `cited_promo_ids`. Indexing
  // it once up front keeps the render loop below O(1) per card.
  const chipsById = new Map(
    (result.promo_chips ?? []).map((c) => [c.promo_id, c]),
  );
  const promoContextDegraded =
    result.promo_context_status === 'degraded' ||
    result.promo_context_status === 'stale';
  const chipLocale: 'th' | 'en' = locale === 'en' ? 'en' : 'th';

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      {/*
        Client-only island: writes the POST_V1 §3 recognition cookie on mount
        so `/` can render a personalized welcome-back hero on the next visit.
        No PII beyond session_id + timestamp.
      */}
      <SessionCookieWriter sessionId={result.session_id} />
      <header className="flex flex-col gap-3">
        <Link href="/selector" className="text-sm text-slate-500 hover:underline">
          {tCommon('back')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          {/*
            Share URL uses only `session_id` from the current path — the
            selector query (spend breakdown, goal) is NOT encoded in the
            URL, so links are safe to paste publicly.
          */}
          <ShareButton sessionId={result.session_id} />
        </div>

        {result.months_to_goal &&
          result.stack.length > 0 &&
          primary &&
          primaryCard && (
            <p className="rounded-md bg-loftly-sky/10 p-4 text-sm text-slate-800">
              {t('monthsToGoalBanner', {
                targetPoints: formatNumber(
                  sumTargetPoints(result) ?? 0,
                  locale,
                ),
                currency,
                months: result.months_to_goal,
              })}
            </p>
          )}

        {result.fallback && (
          <Badge variant="warn" className="w-fit">
            {t('fallbackBadge')}
          </Badge>
        )}
      </header>

      {/* Promo-context degraded banner — shown above the stack so users
          frame recommendations as "ignore the promo signal this run". */}
      {promoContextDegraded && <PromoStaleBanner daysSinceSync={null} />}

      {/* Primary */}
      {primary && primaryCard && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t('primaryLabel')}
          </h2>
          <CardResultCard
            card={primaryCard}
            role="primary"
            position={1}
            earning={{
              monthly_thb: primary.monthly_earning_thb_equivalent,
              monthly_points: primary.monthly_earning_points,
            }}
            applyCtaLabel={<SelectorApplyCtaLabel />}
          />
          {primary.reason_th && (
            <p className="text-sm text-slate-600">{primary.reason_th}</p>
          )}
          {(primary.cited_promo_ids ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(primary.cited_promo_ids ?? []).map((pid) => {
                const chip = chipsById.get(pid);
                if (!chip) return null;
                return (
                  <PromoChip
                    key={pid}
                    promoId={chip.promo_id}
                    merchant={chip.merchant ?? null}
                    discountValue={chip.discount_value ?? null}
                    discountType={chip.discount_type ?? null}
                    validUntil={chip.valid_until ?? null}
                    minSpend={chip.min_spend ?? null}
                    sourceUrl={chip.source_url ?? undefined}
                    locale={chipLocale}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Secondaries */}
      {secondaries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            {t('secondaryLabel')}
          </h2>

          <div className="relative">
            <div
              className={
                locked
                  ? 'pointer-events-none select-none space-y-3 blur-sm filter'
                  : 'space-y-3'
              }
              aria-hidden={locked}
            >
              {secondaries.map((slot, i) => {
                const card = secondaryCards[i] as CardT | null | undefined;
                if (!card) {
                  return (
                    <div
                      key={slot.card_id}
                      className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500"
                    >
                      {slot.slug}
                    </div>
                  );
                }
                // MobileCollapse is a no-op on sm+; on mobile the secondary
                // tiles start collapsed to a preview height and expand on tap.
                return (
                  <MobileCollapse
                    key={slot.card_id}
                    label={t('mobile.expandDetails')}
                  >
                    <CardResultCard
                      card={card}
                      role={slot.role}
                      position={i + 2}
                      earning={{
                        monthly_thb: slot.monthly_earning_thb_equivalent,
                        monthly_points: slot.monthly_earning_points,
                      }}
                      applyCtaLabel={<SelectorApplyCtaLabel />}
                    />
                    {(slot.cited_promo_ids ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(slot.cited_promo_ids ?? []).map((pid) => {
                          const chip = chipsById.get(pid);
                          if (!chip) return null;
                          return (
                            <PromoChip
                              key={pid}
                              promoId={chip.promo_id}
                              merchant={chip.merchant ?? null}
                              discountValue={chip.discount_value ?? null}
                              discountType={chip.discount_type ?? null}
                              validUntil={chip.valid_until ?? null}
                              minSpend={chip.min_spend ?? null}
                              sourceUrl={chip.source_url ?? undefined}
                              locale={chipLocale}
                            />
                          );
                        })}
                      </div>
                    )}
                  </MobileCollapse>
                );
              })}
            </div>

            {locked && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <MagicLinkPrompt
                  sessionId={result.session_id}
                  source="selector_result"
                  className="w-full max-w-lg shadow-md"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* AI rationale — progressively streamed when ?stream=1 is set */}
      {result.rationale_th && (
        <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-medium text-slate-700">
            {t('rationaleTitle')}
          </h2>
          <div className="mt-2">
            <StreamingRationale
              sessionId={result.session_id}
              token={sp.token ?? null}
              fallback={
                locale === 'en' && result.rationale_en
                  ? result.rationale_en
                  : result.rationale_th
              }
              streamingLabel={t('streamingLabel')}
              disconnectedLabel={t('streaming.disconnected')}
              reconnectingLabel={t('streaming.reconnecting')}
              enabled={streamEnabled}
            />
          </div>
        </section>
      )}

      {/*
        POST_V1 §1 follow-up chat — flag-gated client island. When the
        `post_v1_selector_chat` PostHog flag is OFF (default), ChatPanel
        returns null and this section is invisible. When ON, users can
        ask explain-why / what-if questions without leaving the page.
      */}
      <ChatPanel
        sessionId={result.session_id}
        accessToken={accessToken}
        authState={accessToken ? 'authenticated' : 'anon'}
      />

      {/* Footer actions */}
      <footer className="flex flex-wrap items-center gap-4 border-t pt-6 text-sm text-slate-600">
        <Link href="/valuations" className="hover:underline">
          {t('methodAction')}
        </Link>
        <Link href="/selector" className="hover:underline">
          {t('resetAction')}
        </Link>
        {!accessToken && (
          <span className="text-slate-400">{t('saveHint')}</span>
        )}
      </footer>

      {/*
        Mobile-only sticky CTA. Appears after the user scrolls past the
        primary card. `applyHref` falls back to `/selector` when we don't
        have a primary recommendation (e.g. empty stack — shouldn't happen
        but defensive).
      */}
      {primary && primaryCard && (
        <MobileStickyBar applyHref={`/apply/${primaryCard.id}`} />
      )}
    </main>
  );
}

function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'th-TH').format(n);
}

function sumTargetPoints(
  result: SelectorResult,
): number | null {
  // Prefer total stack earning (closer to what drives months_to_goal) —
  // backend guarantees monotonic behavior for this field.
  if (result.total_monthly_earning_points && result.months_to_goal) {
    return result.total_monthly_earning_points * result.months_to_goal;
  }
  return null;
}

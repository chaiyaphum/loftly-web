'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { MagicLinkPrompt } from '@/components/loftly/MagicLinkPrompt';
import { useFeatureFlag } from '@/lib/feature-flags';
import { useTrackEvent } from '@/lib/analytics';
import { LoftlyAPIError } from '@/lib/api/client';
import { postSelectorChat, type ChatResponse } from '@/lib/api/chat';
import { cn } from '@/lib/utils';

/**
 * Selector follow-up chat panel (POST_V1 §1, Tier A).
 *
 * Flag-gated by PostHog `post_v1_selector_chat` (default OFF). Renders null
 * when the flag is not `true` so the existing results page stays untouched
 * for the control cohort.
 *
 * Features:
 *   - 3 suggested prompts that pre-fill the textarea (rankWhy / compare /
 *     whatIf) — they do NOT auto-submit; the user still clicks "Send".
 *   - 500-char limit with a live count (`{n}/500`).
 *   - On submit, POSTs to `/v1/selector/{session_id}/chat`. Response renders:
 *       - Explain/other → paragraph with `answer_th` (or `answer_en` in EN).
 *       - What-if + `cards_changed` → answer paragraph PLUS a collapsible
 *         bullet-list diff of the re-ranked stack ("ดูลำดับใหม่").
 *   - Rate-limit: when `remaining_questions` drops to 0 OR the server returns
 *     429, we disable the textarea and show the "reached cap" message with a
 *     link to `/selector` to start a fresh session.
 *   - Email-gate: 403 switches the panel into a gated mode that renders the
 *     shared `MagicLinkPrompt`. After capture, the user can retry manually.
 *   - Session expiry: 410 locks the panel with a link to `/selector`.
 *
 * Instrumentation:
 *   - `selector_chat_opened` fires once per mount when the flag is ON (the
 *     server-side event sentinel from PR-9 dedupes across the network, but
 *     we also guard client-side via a ref so the panel itself fires once per
 *     page view).
 *   - `selector_chat_question_asked`, `selector_chat_rerank_delivered`, and
 *     `selector_chat_rate_limited` are emitted server-side by loftly-api and
 *     deliberately NOT mirrored here.
 */

const MAX_QUESTION_CHARS = 500;

export interface ChatPanelProps {
  sessionId: string;
  accessToken: string | null;
  authState: 'anon' | 'authenticated';
}

type PanelState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'answered'; response: ChatResponse }
  | { kind: 'rate_limited' }
  | { kind: 'expired' }
  | { kind: 'email_gate' }
  | { kind: 'error'; message?: string };

export function ChatPanel({
  sessionId,
  accessToken,
  authState,
}: ChatPanelProps) {
  const enabled = useFeatureFlag<boolean>('post_v1_selector_chat', false);
  const t = useTranslations('selector.results.chat');
  const locale = useLocale();
  const track = useTrackEvent();
  const textareaId = useId();
  const openedRef = useRef(false);

  const [question, setQuestion] = useState('');
  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showNewStack, setShowNewStack] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (openedRef.current) return;
    openedRef.current = true;
    track('selector_chat_opened', {
      session_id: sessionId,
      auth_state: authState,
    });
  }, [enabled, sessionId, authState, track]);

  if (!enabled) return null;

  const charCount = question.length;
  const isOverLimit = charCount > MAX_QUESTION_CHARS;
  const isLocked =
    state.kind === 'rate_limited' ||
    state.kind === 'expired' ||
    state.kind === 'email_gate';
  const canSubmit =
    !isLocked &&
    state.kind !== 'submitting' &&
    charCount > 0 &&
    !isOverLimit;

  function fillPrompt(value: string) {
    if (isLocked) return;
    setQuestion(value);
    // Clear any prior error surface when the user picks a suggested prompt.
    if (state.kind === 'error') setState({ kind: 'idle' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const trimmed = question.trim();
    if (!trimmed) return;

    setState({ kind: 'submitting' });
    try {
      const response = await postSelectorChat(sessionId, trimmed, {
        accessToken,
      });
      setRemaining(response.remaining_questions);
      setShowNewStack(false);
      if (response.remaining_questions <= 0) {
        // Server returned the 11th answer's ceiling — subsequent sends would
        // 429. Render the answered view but lock input.
        setState({ kind: 'answered', response });
        // Keep local lock consistent with server rate-limit.
        setTimeout(() => {
          // no-op: we rely on isLocked via state transition below
        }, 0);
      } else {
        setState({ kind: 'answered', response });
      }
      setQuestion('');
    } catch (err) {
      if (err instanceof LoftlyAPIError) {
        if (err.status === 429) {
          setState({ kind: 'rate_limited' });
          setRemaining(0);
          return;
        }
        if (err.status === 403) {
          setState({ kind: 'email_gate' });
          return;
        }
        if (err.status === 410 || err.status === 404) {
          setState({ kind: 'expired' });
          return;
        }
      }
      setState({ kind: 'error' });
    }
  }

  // Once the server reports 0 remaining, treat subsequent submits as locked
  // even if the most recent response rendered successfully.
  const effectiveLocked = isLocked || (remaining !== null && remaining <= 0);

  return (
    <section
      aria-labelledby={`${textareaId}-title`}
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4"
    >
      <header className="space-y-1">
        <h2
          id={`${textareaId}-title`}
          className="text-base font-medium text-slate-900"
        >
          {t('title')}
        </h2>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </header>

      {/* Suggested prompts — static trio per §1 acceptance criteria. */}
      <div className="flex flex-wrap gap-2">
        <SuggestedPromptButton
          label={t('suggestedPrompt.rankWhy')}
          onClick={() => fillPrompt(t('suggestedPrompt.rankWhy'))}
          disabled={effectiveLocked}
        />
        <SuggestedPromptButton
          label={t('suggestedPrompt.compare')}
          onClick={() => fillPrompt(t('suggestedPrompt.compare'))}
          disabled={effectiveLocked}
        />
        <SuggestedPromptButton
          label={t('suggestedPrompt.whatIf')}
          onClick={() => fillPrompt(t('suggestedPrompt.whatIf'))}
          disabled={effectiveLocked}
        />
      </div>

      {state.kind === 'email_gate' ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">{t('error.emailGate')}</p>
          <MagicLinkPrompt
            sessionId={sessionId}
            source="selector_result"
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            id={textareaId}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={MAX_QUESTION_CHARS}
            rows={3}
            placeholder={t('input.placeholder')}
            disabled={effectiveLocked || state.kind === 'submitting'}
            aria-invalid={isOverLimit || undefined}
            aria-describedby={`${textareaId}-count`}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100"
          />
          <div className="flex items-center justify-between">
            <span
              id={`${textareaId}-count`}
              className={cn(
                'text-xs text-slate-500',
                isOverLimit && 'text-red-700',
              )}
            >
              {t('input.charCount', { count: charCount })}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              aria-busy={state.kind === 'submitting' || undefined}
            >
              {state.kind === 'submitting'
                ? t('button.sending')
                : t('button.send')}
            </Button>
          </div>
        </form>
      )}

      {/* Error banners (locked modes) */}
      {state.kind === 'rate_limited' && (
        <LockedBanner
          tone="warn"
          message={t('error.rateLimit')}
          linkHref="/selector"
          linkLabel={t('newSelectorLink')}
        />
      )}
      {state.kind === 'expired' && (
        <LockedBanner
          tone="warn"
          message={t('error.expired')}
          linkHref="/selector"
          linkLabel={t('newSelectorLink')}
        />
      )}
      {state.kind === 'error' && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {t('error.generic')}
        </p>
      )}

      {/* Answer rendering */}
      {state.kind === 'answered' && (
        <AnswerBlock
          response={state.response}
          locale={locale}
          rerankedTitle={t('response.rerankedTitle')}
          noCardChangeLabel={t('response.noCardChange')}
          viewNewStackLabel={t('response.viewNewStack')}
          showNewStack={showNewStack}
          onToggleNewStack={() => setShowNewStack((v) => !v)}
        />
      )}

      {/* Remaining-questions counter (hidden until the first answer). */}
      {remaining !== null && state.kind !== 'rate_limited' && (
        <p className="text-xs text-slate-500">
          {t('stats.remaining', { n: Math.max(0, remaining) })}
        </p>
      )}
    </section>
  );
}

function SuggestedPromptButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-slate-50 disabled:hover:text-slate-700',
      )}
    >
      {label}
    </button>
  );
}

function LockedBanner({
  tone,
  message,
  linkHref,
  linkLabel,
}: {
  tone: 'warn' | 'error';
  message: string;
  linkHref: string;
  linkLabel: string;
}) {
  const classes =
    tone === 'warn'
      ? 'rounded-md bg-amber-50 p-3 text-sm text-amber-900'
      : 'rounded-md bg-red-50 p-3 text-sm text-red-900';
  return (
    <div role="status" className={classes}>
      <p>{message}</p>
      <Link
        href={linkHref}
        className="mt-1 inline-block text-sm font-medium underline underline-offset-2"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function AnswerBlock({
  response,
  locale,
  rerankedTitle,
  noCardChangeLabel,
  viewNewStackLabel,
  showNewStack,
  onToggleNewStack,
}: {
  response: ChatResponse;
  locale: string;
  rerankedTitle: string;
  noCardChangeLabel: string;
  viewNewStackLabel: string;
  showNewStack: boolean;
  onToggleNewStack: () => void;
}) {
  const answer =
    locale === 'en' && response.answer_en
      ? response.answer_en
      : response.answer_th;

  const isWhatIf = response.category === 'what-if';
  const hasStack =
    isWhatIf &&
    response.cards_changed &&
    response.new_stack !== null &&
    response.new_stack.length > 0;

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <p className="whitespace-pre-wrap text-sm text-slate-800">{answer}</p>

      {isWhatIf && response.rationale_diff_bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {response.rationale_diff_bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      )}

      {isWhatIf && !response.cards_changed && (
        <p className="text-xs italic text-slate-500">{noCardChangeLabel}</p>
      )}

      {hasStack && (
        <details
          className="rounded-md bg-slate-50 p-3 text-sm"
          open={showNewStack}
        >
          <summary
            onClick={(e) => {
              // Avoid the default toggle fighting with controlled state.
              e.preventDefault();
              onToggleNewStack();
            }}
            className="cursor-pointer font-medium text-slate-700"
          >
            {viewNewStackLabel}
          </summary>
          <div className="mt-2 space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {rerankedTitle}
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">
              {response.new_stack!.map((slot) => (
                <li key={slot.card_id}>
                  <span className="font-medium">{slot.slug}</span>
                  {' — '}
                  <span className="text-slate-600">
                    {formatNumber(slot.monthly_earning_points, locale)} pts /{' '}
                    {formatNumber(
                      slot.monthly_earning_thb_equivalent,
                      locale,
                    )}{' '}
                    THB
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </details>
      )}
    </div>
  );
}

function formatNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'th-TH').format(
    Math.round(n),
  );
}

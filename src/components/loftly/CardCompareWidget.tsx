'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { compareCards, listSimilarCards } from '@/lib/api/cards';
import { LoftlyAPIError } from '@/lib/api/client';
import type { Card, CardComparison } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CardCompareTable } from './CardCompareTable';

/**
 * CardCompareWidget — W17 DEV_PLAN per-card comparison on `/cards/[slug]`.
 *
 * Behaviour:
 *   - Accordion collapsed by default; first expansion lazy-loads similar
 *     cards from `GET /v1/cards/similar/{slug}?limit=5` (cached on the
 *     component instance to avoid repeat fetches).
 *   - Picker is a checkbox list (shadcn Combobox not installed per DEV_PLAN
 *     constraint: "do not add new deps"). Selection is capped at 2 additional
 *     cards so the resulting compare call stays ≤ 3 slugs (source + 2), which
 *     matches the backend `COMPARE_MAX_SLUGS = 3` cap.
 *   - "Compare" click fires `GET /v1/cards/compare?slugs=...`; results render
 *     in `<CardCompareTable />`. Abort signal cancels an in-flight request if
 *     the user re-submits or the component unmounts.
 */

export interface CardCompareWidgetProps {
  /** Source card — always included as the first column of the comparison. */
  sourceSlug: string;
  sourceDisplayName: string;
  /** Optional cap on picker results (defaults to 5; matches DEV_PLAN W17). */
  similarLimit?: number;
  className?: string;
}

type SimilarState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; cards: Card[] }
  | { kind: 'error'; message: string };

type CompareState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: CardComparison[] }
  | { kind: 'error'; message: string };

const MAX_ADDITIONAL_CARDS = 2;

export function CardCompareWidget({
  sourceSlug,
  sourceDisplayName,
  similarLimit = 5,
  className,
}: CardCompareWidgetProps) {
  const t = useTranslations('cards.compare');
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [similar, setSimilar] = useState<SimilarState>({ kind: 'idle' });
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<CompareState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const loadSimilar = useCallback(async () => {
    setSimilar({ kind: 'loading' });
    try {
      const result = await listSimilarCards(sourceSlug, {
        limit: similarLimit,
      });
      setSimilar({ kind: 'ready', cards: result.data });
    } catch (err) {
      setSimilar({
        kind: 'error',
        message: errorMessage(err, t('loadError')),
      });
    }
  }, [sourceSlug, similarLimit, t]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && similar.kind === 'idle') {
      void loadSimilar();
    }
  }

  function toggleSelection(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= MAX_ADDITIONAL_CARDS) {
        return prev;
      }
      return [...prev, slug];
    });
  }

  async function handleCompare() {
    if (selected.length === 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const slugs = [sourceSlug, ...selected];
    setCompare({ kind: 'loading' });
    try {
      const result = await compareCards(slugs, { signal: controller.signal });
      setCompare({ kind: 'ready', data: result.data });
    } catch (err) {
      if (controller.signal.aborted) return;
      setCompare({
        kind: 'error',
        message: errorMessage(err, t('loadError')),
      });
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const maxReached = selected.length >= MAX_ADDITIONAL_CARDS;

  return (
    <section
      className={cn(
        'rounded-md border border-loftly-divider bg-white',
        className,
      )}
      data-testid="card-compare-widget"
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left text-sm font-medium text-loftly-ink hover:bg-loftly-teal-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loftly-sky"
      >
        <span>{t('title')}</span>
        <span
          aria-hidden="true"
          className={cn(
            'text-loftly-ink-muted/70 transition-transform',
            open && 'rotate-180',
          )}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={t('title')}
          className="border-t border-loftly-divider p-4"
        >
          {similar.kind === 'loading' && (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          )}

          {similar.kind === 'error' && (
            <p role="alert" className="text-sm text-loftly-danger">
              {similar.message}
            </p>
          )}

          {similar.kind === 'ready' && similar.cards.length === 0 && (
            <p className="text-sm text-loftly-ink-muted">{t('pickerEmpty')}</p>
          )}

          {similar.kind === 'ready' && similar.cards.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
                {t('picker_placeholder')}
              </legend>
              <ul className="grid gap-2 sm:grid-cols-2">
                {similar.cards.map((c) => {
                  const checked = selected.includes(c.slug);
                  const disabled = !checked && maxReached;
                  return (
                    <li key={c.slug}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-md border border-loftly-divider p-2 text-sm hover:bg-loftly-teal-soft/40',
                          disabled &&
                            'cursor-not-allowed opacity-50 hover:bg-transparent',
                          checked && 'border-loftly-baht bg-loftly-teal-soft/40',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleSelection(c.slug)}
                          aria-label={c.display_name}
                          className="mt-0.5"
                        />
                        <span className="flex-1">
                          <span className="block font-medium text-loftly-ink">
                            {c.display_name}
                          </span>
                          <span className="block text-xs text-loftly-ink-muted">
                            {c.bank.display_name_th}
                            {c.tier ? ` · ${c.tier}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {maxReached && (
                <p className="text-xs text-loftly-ink-muted" role="note">
                  {t('picker_max_reached')}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="button"
                  onClick={handleCompare}
                  disabled={
                    selected.length === 0 || compare.kind === 'loading'
                  }
                  data-testid="compare-submit"
                >
                  {compare.kind === 'loading'
                    ? t('loading')
                    : t('compare_button')}
                </Button>
                <span className="text-xs text-loftly-ink-muted">
                  {sourceDisplayName}
                  {selected.length > 0 && ` + ${selected.length}`}
                </span>
              </div>
            </fieldset>
          )}

          {compare.kind === 'error' && (
            <p role="alert" className="mt-4 text-sm text-loftly-danger">
              {compare.message}
            </p>
          )}

          {compare.kind === 'ready' && (
            <div className="mt-5">
              <CardCompareTable comparisons={compare.data} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof LoftlyAPIError) {
    return err.message_th || err.message_en || fallback;
  }
  return fallback;
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronRight, Search, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { searchMerchants, type MerchantSearchResult } from '@/lib/api/merchants';
import { cn } from '@/lib/utils';

/**
 * HeroSearch — merchant-first hero with interactive search. The search
 * box IS the primary CTA; Selector is a text fallback beneath. Popular
 * chips seed common queries. Mirrors the V1 product-first prototype
 * (design_handoff_homepage_v1) but composes with the existing §15.3
 * below-fold sections (TopPromos · TopMerchants · SelectorCta ·
 * WhyLoftly · LatestReviews · LatestValuations).
 */

const POPULAR = ['Starbucks', 'Lazada', 'Agoda', 'Gourmet', 'Grab'] as const;
const DEBOUNCE_MS = 200;

export function HeroSearch({ initialCount = 160 }: { initialCount?: number }) {
  const t = useTranslations('landing.heroSearch');
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [results, setResults] = React.useState<MerchantSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const rows = await searchMerchants(trimmed, { locale: 'th', signal: ctrl.signal });
        setResults(rows.slice(0, 5));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showDropdown = (focused || query.length > 0) && results.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const top = results[0];
    if (top) router.push(`/merchants/${top.slug}`);
  };

  return (
    <section
      className="relative overflow-hidden px-4 pb-4 pt-16 md:px-6 md:pb-8 md:pt-24"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto max-w-[880px] text-center">
        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-loftly-divider bg-loftly-surface px-3.5 py-1.5 text-body-sm text-loftly-ink-muted shadow-subtle">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-loftly-success"
          />
          {t('statusPill', { count: initialCount })}
        </span>

        <h1
          id="hero-heading"
          className="mb-4 text-loftly-ink"
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
            textWrap: 'balance',
          }}
        >
          {t('h1Prefix')}
          <br />
          {t('h1Connector')}{' '}
          <span className="relative whitespace-nowrap text-loftly-teal">
            <span className="relative z-[1]">{t('h1Accent')}</span>
            <svg
              aria-hidden
              viewBox="0 0 200 10"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-x-0 -bottom-1.5 h-2.5 w-full"
            >
              <path
                d="M2 6 Q50 2 100 5 T198 4"
                stroke="currentColor"
                strokeWidth={2.5}
                fill="none"
                opacity={0.35}
                strokeLinecap="round"
              />
            </svg>
          </span>
          {t('h1Suffix')}
        </h1>
        <p
          className="mx-auto mb-8 max-w-xl text-loftly-ink-muted"
          style={{ fontSize: 'clamp(16px, 2vw, 19px)', lineHeight: 1.5, textWrap: 'pretty' }}
        >
          {t('subheading')}
        </p>

        <form onSubmit={handleSubmit} role="search" className="relative mx-auto max-w-[640px]">
          <div
            className={cn(
              'flex items-center gap-3 rounded-[14px] bg-loftly-surface px-4 py-4 transition-all duration-200 md:gap-3.5 md:px-6 md:py-5',
              focused
                ? 'border-loftly-teal shadow-[0_0_0_6px_rgb(var(--loftly-teal-soft)/0.6),0_8px_32px_rgb(30_42_58/0.08),0_2px_8px_rgb(30_42_58/0.04)]'
                : 'border-loftly-divider-strong shadow',
            )}
            style={{ borderWidth: 2, borderStyle: 'solid' }}
          >
            <Search className="h-5 w-5 shrink-0 text-loftly-ink-subtle" strokeWidth={2} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setFocused(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setFocused(false), 200);
              }}
              placeholder={t('placeholder')}
              aria-label={t('ariaInput')}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-transparent text-[16px] text-loftly-ink placeholder:text-loftly-ink-subtle focus:outline-none md:text-[18px]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label={t('clear')}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-loftly-surface-muted text-loftly-ink-muted hover:text-loftly-ink"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            ) : null}
            <kbd className="hidden shrink-0 rounded border border-loftly-divider bg-loftly-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-loftly-ink-subtle sm:inline-flex">
              ⌘K
            </kbd>
          </div>

          {showDropdown ? (
            <div
              role="listbox"
              aria-label={t('ariaResults')}
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-[5] overflow-hidden rounded-[14px] border border-loftly-divider bg-loftly-surface text-left shadow-[0_8px_32px_rgb(30_42_58/0.08),0_2px_8px_rgb(30_42_58/0.04)]"
              onMouseDown={(e) => e.preventDefault()}
            >
              {results.map((m, i) => (
                <Link
                  key={m.slug}
                  href={`/merchants/${m.slug}`}
                  role="option"
                  aria-selected={i === 0}
                  className={cn(
                    'grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-loftly-surface-muted sm:grid-cols-[auto_1fr_auto_auto] sm:gap-4 sm:px-5 sm:py-3.5',
                    i > 0 && 'border-t border-loftly-divider',
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-loftly-surface-muted text-[14px] font-semibold text-loftly-ink-muted sm:h-10 sm:w-10">
                    {m.display_name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-loftly-ink">
                      {m.display_name}
                    </span>
                    <span className="mt-0.5 block truncate text-body-sm text-loftly-ink-muted">
                      {m.category_default
                        ? `${m.category_default} · ${t('activePromos', { count: m.active_promo_count })}`
                        : t('activePromos', { count: m.active_promo_count })}
                    </span>
                  </span>
                  <span className="hidden text-right sm:block">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-loftly-ink-subtle">
                      {t('earn')}
                    </span>
                    <span className="font-mono text-[14px] font-semibold text-loftly-teal">
                      {t('earnPer1k')}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-loftly-ink-subtle" aria-hidden />
                </Link>
              ))}
              <div className="flex items-center justify-between bg-loftly-surface-muted px-4 py-3 text-caption text-loftly-ink-subtle sm:px-5">
                <span>{t('showing', { count: results.length })}</span>
                <span className="hidden sm:inline">
                  {t('pressEnterPrefix')}{' '}
                  <kbd className="rounded border border-loftly-divider bg-loftly-surface px-1 py-0.5 font-mono text-[11px]">
                    ↵
                  </kbd>{' '}
                  {t('pressEnterSuffix')}
                </span>
              </div>
            </div>
          ) : null}
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-body-sm text-loftly-ink-muted">
          <span className="opacity-70">{t('popular')}</span>
          {POPULAR.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setQuery(term);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-loftly-divider bg-loftly-surface px-2.5 py-0.5 text-body-sm text-loftly-ink transition-colors hover:border-loftly-teal hover:text-loftly-teal"
            >
              {term}
            </button>
          ))}
          {loading ? (
            <span className="text-caption text-loftly-ink-subtle">{t('loading')}</span>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <span
            className="flex items-center gap-3 text-caption uppercase tracking-[0.14em] text-loftly-ink-subtle"
            aria-hidden
          >
            <span aria-hidden className="h-px w-10 bg-loftly-divider" />
            {t('altCtaLead')}
            <span aria-hidden className="h-px w-10 bg-loftly-divider" />
          </span>
          <Link
            href="/selector"
            className="group/selector-cta inline-flex h-12 items-center gap-2 rounded-full border-2 border-loftly-teal bg-loftly-surface px-7 text-body font-semibold text-loftly-teal shadow-subtle transition-all hover:-translate-y-0.5 hover:bg-loftly-teal-soft hover:shadow"
          >
            <span>{t('altCta')}</span>
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover/selector-cta:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <span className="text-caption text-loftly-ink-subtle">
            {t('altCtaHint')}
          </span>
        </div>
      </div>
    </section>
  );
}

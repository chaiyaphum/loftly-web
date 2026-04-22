'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchMerchants, type MerchantSearchResult } from '@/lib/api/merchants';

/**
 * MerchantSearchBar — client-side autocomplete for the `/merchants/[slug]`
 * surface. Debounces input, hits `/v1/merchants/search`, and navigates on
 * pick. Rendered on the landing page (secondary CTA slot below the
 * primary Selector CTA) and at the top of `/merchants`.
 *
 * Behavioral notes:
 *   - 200ms debounce — feels instant without hammering the API.
 *   - Abort in-flight requests when a new keystroke comes in.
 *   - Enter key navigates to the top match if any.
 *   - Graceful empty state with "similar merchants" deferred to
 *     `SimilarMerchants` (rendered by the caller on zero-result searches).
 */

export interface MerchantSearchBarProps {
  /** Placeholder text — pass Thai or English. */
  placeholder?: string;
  /** Empty-state label when zero results. */
  emptyLabel?: string;
  /** Optional initial value (e.g. resumed search). */
  initial?: string;
  /** Visual variant — `inline` is compact for the landing hero, `full` is the `/merchants` hero. */
  variant?: 'inline' | 'full';
  className?: string;
}

const DEBOUNCE_MS = 200;

export function MerchantSearchBar({
  placeholder = 'ค้นหาร้านค้า เช่น Starbucks, Grab, Shopee',
  emptyLabel = 'ไม่พบร้าน ลองดูร้านที่คล้ายกัน...',
  initial = '',
  variant = 'inline',
  className,
}: MerchantSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initial);
  const [results, setResults] = React.useState<MerchantSearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const rows = await searchMerchants(trimmed, {
          locale: 'th',
          signal: controller.signal,
        });
        setResults(rows);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          // Swallow — autocomplete failures must not break the input.
          setResults([]);
          setOpen(true);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const top = results[0];
    if (top) {
      router.push(`/merchants/${top.slug}`);
    }
  };

  const heroClasses =
    variant === 'full'
      ? 'w-full max-w-2xl'
      : 'w-full max-w-md';

  return (
    <div className={`${heroClasses} ${className ?? ''}`}>
      <form onSubmit={onSubmit} className="flex gap-2" role="search">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="ค้นหาร้านค้า"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" variant="default">
          ค้นหา
        </Button>
      </form>

      {open && (
        <div
          role="listbox"
          className="mt-2 rounded-md border border-loftly-divider bg-loftly-surface shadow"
        >
          {loading && (
            <p className="px-3 py-2 text-body-sm text-loftly-ink-muted">กำลังค้นหา…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-body-sm text-loftly-ink-muted">{emptyLabel}</p>
          )}
          {!loading &&
            results.map((r) => (
              <Link
                key={r.slug}
                href={`/merchants/${r.slug}`}
                role="option"
                className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm hover:bg-loftly-teal-soft"
              >
                <span className="flex items-center gap-2">
                  {r.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.logo_url}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded"
                    />
                  )}
                  <span className="font-medium text-loftly-ink">{r.display_name}</span>
                  {r.category_default && (
                    <span className="text-caption text-loftly-ink-muted">
                      {r.category_default}
                    </span>
                  )}
                </span>
                {r.active_promo_count > 0 && (
                  <span className="text-caption font-medium text-loftly-teal">
                    {r.active_promo_count} โปรฯ
                  </span>
                )}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

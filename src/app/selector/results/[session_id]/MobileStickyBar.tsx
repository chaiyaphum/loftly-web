'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/**
 * Bottom-of-viewport sticky CTA bar for mobile. Appears only after the user
 * has scrolled past the primary card ("past the fold"). Hidden above the
 * `sm:` breakpoint — desktop users see the inline footer actions.
 *
 * We avoid IntersectionObserver to keep the bundle small; a single scroll
 * listener (passive, throttled via requestAnimationFrame) is enough for
 * this lightweight signal.
 */

interface Props {
  /** Apply URL for the primary card — link not button, for crawlability. */
  applyHref: string;
  /** Selector (re-run) URL — always `/selector` today but kept as prop for SSR testability. */
  rerunHref?: string;
  /**
   * Scroll offset (px) past which the bar becomes visible. Default ≈ fold
   * on a 640px-wide mobile viewport.
   */
  showAfterPx?: number;
}

export function MobileStickyBar({
  applyHref,
  rerunHref = '/selector',
  showAfterPx = 320,
}: Props) {
  const t = useTranslations('selector.results.mobile');
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setVisible(window.scrollY > showAfterPx);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showAfterPx]);

  return (
    <div
      aria-hidden={!visible}
      data-testid="selector-sticky-bar"
      data-visible={visible}
      className={
        // Mobile-only (hidden on sm+), fixed to bottom, transforms in from
        // below when visible. `pointer-events-none` when hidden so the
        // off-screen bar doesn't block touches on footer links.
        [
          'fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-loftly-divider bg-white p-3 shadow-lg sm:hidden',
          'transition-transform duration-200',
          visible
            ? 'translate-y-0'
            : 'pointer-events-none translate-y-full',
        ].join(' ')
      }
    >
      <Button asChild className="flex-1" size="sm">
        <a href={applyHref} rel="sponsored nofollow">
          {t('stickyApply')}
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={rerunHref}>{t('stickyRerun')}</Link>
      </Button>
    </div>
  );
}

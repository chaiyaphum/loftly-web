'use client';

import * as React from 'react';

/**
 * Collapses its children to a preview height on mobile (< sm) and reveals the
 * full content when tapped. On sm+ viewports the wrapper is a no-op — desktop
 * users always see the full card.
 *
 * Defaults to collapsed on mobile (per task spec: "Card details collapsed by
 * default on mobile; tap to expand"). State is local; a fresh mount (e.g. a
 * retry) resets back to collapsed.
 */

interface Props {
  children: React.ReactNode;
  label: string;
  previewHeightPx?: number;
}

export function MobileCollapse({
  children,
  label,
  previewHeightPx = 140,
}: Props) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="relative" data-testid="mobile-collapse">
      <div
        className="overflow-hidden sm:!max-h-none"
        style={{
          maxHeight: expanded ? undefined : previewHeightPx,
        }}
        aria-expanded={expanded}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 w-full rounded-md border border-loftly-divider py-2 text-xs font-medium text-loftly-ink-muted sm:hidden"
        data-testid="mobile-collapse-toggle"
      >
        {label} {expanded ? '▲' : '▼'}
      </button>
    </div>
  );
}

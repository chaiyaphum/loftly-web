import { getTranslations } from 'next-intl/server';

/**
 * PromoStaleBanner — shown above the selector stack when the promo context is
 * `degraded` or the snapshot is > 72h old. Copy tells the user the promo data
 * is for reference only and shouldn't gate decisions.
 *
 * POST_V1 §3 Tier A (2026-04-22) — Promo-Aware Card Selector.
 * Kept server-side + dependency-free so it renders on the SSR path without a
 * client-component waterfall.
 */
export async function PromoStaleBanner({
  daysSinceSync,
}: {
  /** Days since last sync. Pass `null` when unknown (pure "degraded" state). */
  daysSinceSync?: number | null;
}) {
  const t = await getTranslations('selector.promo');
  // Fallback to a sane default when the digest doesn't carry freshness info —
  // the copy is clear about "ข้อมูลเก่า" either way.
  const days = daysSinceSync ?? 3;
  return (
    <div
      role="status"
      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
    >
      {t('stale', { days })}
    </div>
  );
}

import { getTranslations } from 'next-intl/server';

/**
 * TrustStrip — 4 stat blocks (design_handoff §Component 6).
 * Stats are copy-driven (not live) so the home page stays fast;
 * numbers match the brand narrative (160+ promos, ~฿0.82 per mile,
 * 40+ cards, 100% affiliate-disclosed).
 */

const STATS = [
  { k: '160+', keyKey: 'livePromos' as const },
  { k: '฿0.82', keyKey: 'perMile' as const },
  { k: '40+', keyKey: 'cardsReviewed' as const },
  { k: '100%', keyKey: 'affiliate' as const },
];

export async function TrustStrip() {
  const t = await getTranslations('landing.trust');

  return (
    <section className="px-4 py-20 md:px-6" aria-labelledby="trust-heading">
      <h2 id="trust-heading" className="sr-only">
        {t('srHeading')}
      </h2>
      <ul className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <li key={s.k}>
            <p
              className="font-mono text-loftly-teal"
              style={{
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {s.k}
            </p>
            <p className="mt-2.5 text-body-sm font-medium text-loftly-ink">
              {t(`${s.keyKey}.label`)}
            </p>
            <p
              className="mt-1 text-body-sm text-loftly-ink-muted"
              style={{ lineHeight: 1.5 }}
            >
              {t(`${s.keyKey}.desc`)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

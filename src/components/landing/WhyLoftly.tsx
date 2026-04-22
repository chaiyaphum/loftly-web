import { getTranslations } from 'next-intl/server';
import { Building2, Radio, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * WhyLoftly — 3 concrete pillars per brief §15.3 section 4: live promo
 * data, merchant-level intel, Thai-language AI. Stat text uses real-
 * feeling numbers via translation (set from backend counts once wired).
 */

type Pillar = {
  key: 'livePromo' | 'merchantIntel' | 'thaiAi';
  icon: LucideIcon;
};

const PILLARS: Pillar[] = [
  { key: 'livePromo', icon: Radio },
  { key: 'merchantIntel', icon: Building2 },
  { key: 'thaiAi', icon: Sparkles },
];

export async function WhyLoftly() {
  const t = await getTranslations('landing.whyLoftly');

  return (
    <section
      className="flex flex-col gap-6"
      aria-labelledby="why-loftly-heading"
    >
      <h2
        id="why-loftly-heading"
        className="text-heading-lg text-loftly-ink"
      >
        {t('heading')}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {PILLARS.map(({ key, icon: Icon }) => (
          <article
            key={key}
            className="flex flex-col gap-3 rounded-lg border border-loftly-divider bg-loftly-surface p-6 shadow-subtle"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-loftly-teal-soft text-loftly-teal"
            >
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <h3 className="text-heading text-loftly-ink">
              {t(`${key}.title`)}
            </h3>
            <p className="text-body-sm text-loftly-ink-muted">
              {t(`${key}.body`)}
            </p>
            <p className="mt-auto text-caption font-medium text-loftly-teal">
              {t(`${key}.stat`)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

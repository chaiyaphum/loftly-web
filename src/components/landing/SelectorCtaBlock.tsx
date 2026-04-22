import { getTranslations } from 'next-intl/server';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/routing';

/**
 * SelectorCtaBlock — "หรือบอกการใช้จ่ายของคุณ" pitch for the deep-
 * analysis path (brief §15.3 section 3). Lives below the merchant-led
 * hero so drive-by users hit value first; this surface invites the
 * users who want the full spend-profile treatment.
 */
export async function SelectorCtaBlock() {
  const t = await getTranslations('landing.selectorCta');

  return (
    <section aria-labelledby="selector-cta-heading">
      <div className="relative overflow-hidden rounded-lg border border-loftly-divider bg-loftly-teal-soft px-6 py-8 md:flex md:items-center md:gap-8 md:px-10 md:py-10">
        <div className="flex-1 space-y-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-loftly-surface px-2 py-0.5 text-caption font-medium text-loftly-teal">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t('eyebrow')}
          </span>
          <h2
            id="selector-cta-heading"
            className="text-heading-lg text-loftly-ink"
          >
            {t('heading')}
          </h2>
          <p className="max-w-xl text-body text-loftly-ink-muted">
            {t('body')}
          </p>
          <p className="text-body-sm text-loftly-ink-muted">
            <strong className="font-medium text-loftly-ink">
              {t('whyGoDeepLabel')}
            </strong>{' '}
            {t('whyGoDeepBody')}
          </p>
        </div>
        <div className="mt-6 flex flex-col items-start gap-2 md:mt-0 md:shrink-0">
          <Link
            href="/selector"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-loftly-teal px-6 text-body font-medium text-white shadow-subtle transition-colors hover:bg-loftly-teal-hover"
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="text-caption text-loftly-ink-muted">
            {t('reassurance')}
          </p>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'นโยบายความเป็นส่วนตัว',
  description:
    'นโยบายความเป็นส่วนตัวของ Loftly — ข้อมูลที่เราเก็บ วัตถุประสงค์ การประมวลผล และสิทธิ์ตาม PDPA',
  path: '/legal/privacy',
});

/**
 * Privacy Policy — stub scaffold.
 *
 * Per DEV_PLAN W12: structure only; Thai legal-reviewed copy lands closer to
 * soft launch. The TOC + last-updated metadata + placeholder notice are the
 * deliverable here.
 */
export default async function PrivacyPage() {
  const t = await getTranslations('legal');

  const sections: Array<{ id: string; title: string }> = [
    { id: 'who-we-are', title: t('privacyToc.whoWeAre') },
    { id: 'data', title: t('privacyToc.dataWeCollect') },
    { id: 'lawful-basis', title: t('privacyToc.lawfulBasis') },
    { id: 'rights', title: t('privacyToc.yourRights') },
    { id: 'retention', title: t('privacyToc.retention') },
    { id: 'contact', title: t('privacyToc.contact') },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">{t('privacyTitle')}</h1>
        <p className="text-sm text-loftly-ink-muted">
          {t('lastUpdatedLabel')}: {t('lastUpdatedValue')}
        </p>
      </header>

      <nav
        aria-label={t('tocLabel')}
        className="rounded-md border border-loftly-divider bg-loftly-teal-soft/40 p-4"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-loftly-ink-muted">
          {t('tocLabel')}
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-loftly-sky hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <p className="rounded-md bg-loftly-amber/15 p-3 text-sm text-loftly-amber-urgent">
        {t('placeholderNotice')}
      </p>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <p className="text-sm text-loftly-ink-muted">
            {/* TODO(legal): reviewed Thai/English copy replaces this placeholder */}
            Content pending legal review.
          </p>
        </section>
      ))}
    </main>
  );
}

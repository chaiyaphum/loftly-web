import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'เงื่อนไขการใช้บริการ',
  description:
    'เงื่อนไขการใช้บริการของ Loftly — ขอบเขตบริการ ความถูกต้องของข้อมูล บัญชีผู้ใช้ affiliate และข้อจำกัดความรับผิด',
  path: '/legal/terms',
});

export default async function TermsPage() {
  const t = await getTranslations('legal');

  const sections: Array<{ id: string; title: string }> = [
    { id: 'service', title: t('termsToc.service') },
    { id: 'accuracy', title: t('termsToc.accuracy') },
    { id: 'accounts', title: t('termsToc.accounts') },
    { id: 'affiliate', title: t('termsToc.affiliate') },
    { id: 'liability', title: t('termsToc.liability') },
    { id: 'law', title: t('termsToc.law') },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">{t('termsTitle')}</h1>
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
              <a href={`#${s.id}`} className="text-loftly-teal hover:underline">
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
            {/* TODO(legal): reviewed copy replaces this placeholder */}
            Content pending legal review.
          </p>
        </section>
      ))}
    </main>
  );
}

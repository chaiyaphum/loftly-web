import { getTranslations } from 'next-intl/server';

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
        <p className="text-sm text-slate-500">
          {t('lastUpdatedLabel')}: {t('lastUpdatedValue')}
        </p>
      </header>

      <nav
        aria-label={t('tocLabel')}
        className="rounded-md border border-slate-200 bg-slate-50 p-4"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
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

      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        {t('placeholderNotice')}
      </p>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <p className="text-sm text-slate-600">
            {/* TODO(legal): reviewed copy replaces this placeholder */}
            Content pending legal review.
          </p>
        </section>
      ))}
    </main>
  );
}

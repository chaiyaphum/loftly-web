import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Landing page — structure follows WF-1 in UI_WEB.md.
// Visual polish is deferred to Phase 1 Week 2 design pass.
export default async function LandingPage() {
  const t = await getTranslations('landing');

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-12 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-xl font-semibold">Loftly</span>
        <nav className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">TH | EN</span>
          {/* Sign-in is Phase 1 Week 2+ — placeholder */}
          <span className="text-slate-500">Sign in</span>
        </nav>
      </header>

      <section className="flex flex-col gap-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t('title')}</h1>
        <p className="text-lg text-slate-600">{t('subtitle')}</p>
        <div>
          <Button asChild>
            <Link href="/selector">{t('cta')}</Link>
          </Button>
        </div>
        <p className="text-sm text-slate-500">{t('reassurance')}</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">{t('howItWorksTitle')}</h2>
        <ol className="list-decimal space-y-2 pl-6 text-slate-700">
          <li>{t('howItWorks.step1')}</li>
          <li>{t('howItWorks.step2')}</li>
          <li>{t('howItWorks.step3')}</li>
        </ol>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">{t('latestReviewsTitle')}</h2>
          {/* Wire up /cards list preview later */}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t('latestValuationsTitle')}</h2>
          {/* Wire up /valuations preview later */}
        </div>
      </section>

      <footer className="mt-auto border-t pt-6 text-sm text-slate-500">
        <div className="flex gap-4">
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/affiliate-disclosure">Affiliate disclosure</Link>
        </div>
      </footer>
    </main>
  );
}

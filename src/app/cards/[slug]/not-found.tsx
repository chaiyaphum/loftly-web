import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function CardNotFound() {
  const t = await getTranslations('cards');
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold">{t('notFoundTitle')}</h1>
      <p className="mt-3 text-sm text-slate-600">{t('notFoundBody')}</p>
      <div className="mt-6">
        <Button asChild variant="outline">
          <Link href="/cards">{t('notFoundBackCta')}</Link>
        </Button>
      </div>
    </main>
  );
}

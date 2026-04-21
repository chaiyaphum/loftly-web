import { getTranslations } from 'next-intl/server';
import { AffiliateDisclosure } from '@/components/loftly/AffiliateDisclosure';

export default async function AffiliateDisclosurePage() {
  const t = await getTranslations('legal');

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('affiliateDisclosureTitle')}</h1>
      <AffiliateDisclosure variant="footer" />
    </main>
  );
}

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { DataExportClient } from './DataExportClient';
import { NOINDEX_METADATA } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  ...NOINDEX_METADATA,
  title: 'ดาวน์โหลดข้อมูลส่วนตัว',
};

/**
 * `/account/data-export` — PDPA §7 right-to-access self-service flow.
 *
 * SSR shell reads the `loftly_export_job` cookie so users landing back on
 * the page after requesting an export see their in-flight job resume
 * polling. The actual network calls live in the `DataExportClient`
 * island.
 *
 * Rate limit: 2 requests / day enforced backend-side; UI surfaces a
 * friendly Thai message if the backend returns 429.
 *
 * 501 handling: the endpoint is stub until Month 3 soft-launch; the
 * client renders a "coming soon" notice instead of breaking the page.
 */
export default async function AccountDataExportPage() {
  const t = await getTranslations('account.dataExport');

  const cookieStore = await cookies();
  const initialJobId = cookieStore.get('loftly_export_job')?.value;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-loftly-ink-muted">{t('intro')}</p>
      </header>

      <DataExportClient initialJobId={initialJobId} />
    </main>
  );
}

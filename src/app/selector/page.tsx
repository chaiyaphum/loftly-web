import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SelectorPane } from './SelectorPane';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  title: 'ค้นหาบัตรที่ใช่',
  description:
    'บอกเราเรื่องการใช้จ่ายและเป้าหมาย เราจะคำนวณบัตรที่คุ้มที่สุดให้ภายใน 10 วินาที',
  path: '/selector',
});

/**
 * Selector input page (WF-2). Matches the wireframe top-to-bottom:
 *   - Back chevron + title in the heading
 *   - Total monthly spend input
 *   - Category sliders (residual → `other`)
 *   - Goal radio + conditional miles fields
 *   - Current cards placeholder (full card search lands W7+)
 *   - Submit CTA
 */
export default async function SelectorPage() {
  const t = await getTranslations('selector');

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('subtitle')}</p>
      </header>
      <SelectorPane />
    </main>
  );
}

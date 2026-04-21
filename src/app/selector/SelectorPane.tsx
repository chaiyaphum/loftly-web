'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFeatureFlag } from '@/lib/feature-flags';
import { SelectorForm } from './SelectorForm';
import { SelectorNluTab } from './SelectorNluTab';
import type { SelectorDraftValues } from '@/lib/schemas/selector';

type Tab = 'form' | 'nlu';

/**
 * Tab-switcher shell for the Selector entry page.
 *
 * Default = structured form (`SelectorForm`). When the PostHog flag
 * `typhoon_nlu_spend` resolves to `true`, a second tab ("อธิบายเป็นคำพูด"
 * / "Describe in words") becomes available. A successful parse auto-fills
 * the structured form and switches back so the user can review before
 * submission. A 501 from the backend permanently hides the NLU tab for
 * this session.
 */
export function SelectorPane() {
  const t = useTranslations('selector.nlu');
  const flagEnabled = useFeatureFlag<boolean>('typhoon_nlu_spend', false);
  const [tab, setTab] = useState<Tab>('form');
  const [seed, setSeed] = useState<SelectorDraftValues | null>(null);
  const [hideNluTab, setHideNluTab] = useState(false);
  const [justParsed, setJustParsed] = useState(false);

  // Remount SelectorForm with fresh state every time the seed changes so
  // the `useState` initializer picks up the new defaults. A stable `key`
  // would re-use state across seeds.
  const formKey = seed ? JSON.stringify(seed.monthly_spend_thb) + seed.goal.type + seed.spend_categories.dining : 'default';

  const showNluTab = flagEnabled && !hideNluTab;

  return (
    <div className="space-y-6">
      {showNluTab && (
        <div
          role="tablist"
          aria-label="selector-input-mode"
          className="flex gap-2 rounded-md border border-slate-200 bg-slate-50 p-1 text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'form'}
            onClick={() => setTab('form')}
            className={
              'flex-1 rounded px-3 py-2 font-medium transition-colors ' +
              (tab === 'form'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900')
            }
          >
            {t('form_tab_label')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'nlu'}
            onClick={() => setTab('nlu')}
            className={
              'flex-1 rounded px-3 py-2 font-medium transition-colors ' +
              (tab === 'nlu'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900')
            }
          >
            {t('tab_label')}
          </button>
        </div>
      )}

      {showNluTab && tab === 'nlu' ? (
        <SelectorNluTab
          onParsed={(next) => {
            setSeed(next);
            setJustParsed(true);
            setTab('form');
          }}
          onDisabled={() => {
            // Backend says the flag is off — permanently hide the tab and
            // drop back to the structured form for this page session.
            setHideNluTab(true);
            setTab('form');
          }}
          onBack={() => setTab('form')}
        />
      ) : (
        <SelectorForm
          key={formKey}
          initialValues={seed ?? undefined}
          reviewHint={justParsed ? t('review_hint') : undefined}
        />
      )}
    </div>
  );
}

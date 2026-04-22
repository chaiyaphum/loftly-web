import { getTranslations } from 'next-intl/server';

/**
 * HowItWorks — 3 numbered cards: tell · see · apply
 * (design_handoff §Component 4). Each card has an illustrative visual:
 *   01 — stacked category bars
 *   02 — mono THB math grid
 *   03 — promo chips
 */

function StepOneVisual() {
  const heights = [45, 65, 55, 85, 35, 50];
  return (
    <div className="mt-4 flex h-20 items-end gap-1.5">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-loftly-teal"
          style={{ height: `${h}%`, opacity: 0.2 + i * 0.12 }}
        />
      ))}
    </div>
  );
}

function StepTwoVisual({
  labels,
}: {
  labels: { primary: string; secondary: string; tertiary: string; total: string };
}) {
  return (
    <div className="mt-4 grid gap-1 font-mono text-[12px] text-loftly-ink-muted">
      <div className="flex items-center justify-between">
        <span>{labels.primary}</span>
        <span className="font-semibold text-loftly-teal">฿13,224</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{labels.secondary}</span>
        <span>฿1,608</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{labels.tertiary}</span>
        <span>฿456</span>
      </div>
      <div className="my-1 h-px bg-loftly-divider" />
      <div className="flex items-center justify-between font-semibold text-loftly-ink">
        <span>{labels.total}</span>
        <span>฿15,288</span>
      </div>
    </div>
  );
}

function StepThreeVisual({ chips }: { chips: Array<{ label: string; tone: 'amber' | 'danger' }> }) {
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={i}
          className={
            'rounded-full px-2.5 py-1 text-[11px] font-medium ' +
            (chip.tone === 'danger'
              ? 'bg-loftly-danger-soft text-loftly-danger'
              : 'bg-loftly-amber-soft text-loftly-amber-urgent')
          }
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export async function HowItWorks() {
  const t = await getTranslations('landing.howItWorks');

  const steps = [
    {
      n: '01',
      title: t('step1.title'),
      body: t('step1.body'),
      visual: <StepOneVisual />,
    },
    {
      n: '02',
      title: t('step2.title'),
      body: t('step2.body'),
      visual: (
        <StepTwoVisual
          labels={{
            primary: t('step2.mathPrimary'),
            secondary: t('step2.mathSecondary'),
            tertiary: t('step2.mathTertiary'),
            total: t('step2.mathTotal'),
          }}
        />
      ),
    },
    {
      n: '03',
      title: t('step3.title'),
      body: t('step3.body'),
      visual: (
        <StepThreeVisual
          chips={[
            { label: t('step3.chipA'), tone: 'amber' },
            { label: t('step3.chipB'), tone: 'danger' },
            { label: t('step3.chipC'), tone: 'amber' },
            { label: t('step3.chipD'), tone: 'amber' },
          ]}
        />
      ),
    },
  ];

  return (
    <section className="px-4 py-24 md:px-6" aria-labelledby="how-it-works-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-caption font-semibold uppercase tracking-[0.08em] text-loftly-teal">
            {t('eyebrow')}
          </p>
          <h2
            id="how-it-works-heading"
            className="mx-auto max-w-[680px] text-loftly-ink"
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              textWrap: 'balance',
            }}
          >
            {t('heading')}
          </h2>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex flex-col rounded-2xl border border-loftly-divider bg-loftly-surface p-7 shadow-subtle"
            >
              <span className="font-mono text-[13px] font-medium text-loftly-ink-subtle">
                {s.n}
              </span>
              <h3 className="mb-2 mt-3 text-[22px] font-semibold tracking-[-0.015em] text-loftly-ink">
                {s.title}
              </h3>
              <p className="text-body-sm text-loftly-ink-muted" style={{ lineHeight: 1.55 }}>
                {s.body}
              </p>
              <div className="flex-1" />
              {s.visual}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

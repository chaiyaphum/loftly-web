'use client';

import * as React from 'react';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { createAdminCard, updateAdminCard } from '@/lib/api/admin';
import type { CardUpsert } from '@/lib/api/admin';
import type { Card, CardStatus } from '@/lib/api/types';
import { Input } from '@/components/ui/input';
import { LoftlyAPIError } from '@/lib/api/client';

/**
 * Zod schema mirroring `CardUpsert` in openapi.yaml — additionalProperties:true
 * upstream, but we enforce the known-core fields client-side for quick feedback.
 */
const schema = z.object({
  slug: z.string().min(1).optional(),
  display_name: z.string().min(1),
  bank_slug: z.string().min(1),
  tier: z.string().nullable().optional(),
  network: z.string().min(1),
  annual_fee_thb: z.number().nullable().optional(),
  annual_fee_waiver: z.string().nullable().optional(),
  min_income_thb: z.number().nullable().optional(),
  min_age: z.number().int().nullable().optional(),
  earn_currency_code: z.string().min(1),
  earn_rate_local: z.record(z.number()),
  earn_rate_foreign: z.record(z.number()).nullable().optional(),
  benefits: z.record(z.unknown()).optional(),
  signup_bonus: z
    .object({
      bonus_points: z.number().int(),
      spend_required: z.number(),
      timeframe_days: z.number().int(),
    })
    .nullable()
    .optional(),
  description_th: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
});

interface Props {
  card?: Card;
  accessToken: string;
}

export function CardForm({ card, accessToken }: Props) {
  const router = useRouter();
  const [state, setState] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const [formValues, setFormValues] = React.useState<{
    display_name: string;
    slug: string;
    bank_slug: string;
    tier: string;
    network: string;
    annual_fee_thb: string;
    annual_fee_waiver: string;
    min_income_thb: string;
    min_age: string;
    earn_currency_code: string;
    earn_rate_local: string;
    earn_rate_foreign: string;
    benefits: string;
    signup_bonus: string;
    description_th: string;
    description_en: string;
    status: CardStatus;
  }>(() => ({
    display_name: card?.display_name ?? '',
    slug: card?.slug ?? '',
    bank_slug: card?.bank.slug ?? '',
    tier: card?.tier ?? '',
    network: card?.network ?? 'Visa',
    annual_fee_thb: card?.annual_fee_thb != null ? String(card.annual_fee_thb) : '',
    annual_fee_waiver: card?.annual_fee_waiver ?? '',
    min_income_thb:
      card?.min_income_thb != null ? String(card.min_income_thb) : '',
    min_age: card?.min_age != null ? String(card.min_age) : '',
    earn_currency_code: card?.earn_currency.code ?? '',
    earn_rate_local: JSON.stringify(card?.earn_rate_local ?? {}, null, 2),
    earn_rate_foreign: card?.earn_rate_foreign
      ? JSON.stringify(card.earn_rate_foreign, null, 2)
      : '',
    benefits: card?.benefits ? JSON.stringify(card.benefits, null, 2) : '{}',
    signup_bonus: card?.signup_bonus
      ? JSON.stringify(card.signup_bonus, null, 2)
      : '',
    description_th: card?.description_th ?? '',
    description_en: card?.description_en ?? '',
    status: card?.status ?? 'inactive',
  }));

  function set<K extends keyof typeof formValues>(
    key: K,
    value: (typeof formValues)[K],
  ) {
    setFormValues((p) => ({ ...p, [key]: value }));
  }

  function parseJson<T>(raw: string, fallback: T | null = null): T | null {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    return JSON.parse(trimmed) as T;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setState('saving');
    setError(null);

    try {
      const payload: CardUpsert = schema.parse({
        slug: formValues.slug || undefined,
        display_name: formValues.display_name,
        bank_slug: formValues.bank_slug,
        tier: formValues.tier || null,
        network: formValues.network,
        annual_fee_thb: formValues.annual_fee_thb
          ? Number(formValues.annual_fee_thb)
          : null,
        annual_fee_waiver: formValues.annual_fee_waiver || null,
        min_income_thb: formValues.min_income_thb
          ? Number(formValues.min_income_thb)
          : null,
        min_age: formValues.min_age ? Number(formValues.min_age) : null,
        earn_currency_code: formValues.earn_currency_code,
        earn_rate_local: parseJson<Record<string, number>>(
          formValues.earn_rate_local,
          {},
        )!,
        earn_rate_foreign: formValues.earn_rate_foreign
          ? parseJson<Record<string, number>>(formValues.earn_rate_foreign)
          : null,
        benefits: parseJson<Record<string, unknown>>(formValues.benefits, {})!,
        signup_bonus: formValues.signup_bonus
          ? parseJson(formValues.signup_bonus)
          : null,
        description_th: formValues.description_th || null,
        description_en: formValues.description_en || null,
        status: formValues.status,
      });

      if (card) {
        await updateAdminCard(card.id, payload, accessToken);
      } else {
        await createAdminCard(payload, accessToken);
      }
      router.push('/admin/cards');
      router.refresh();
    } catch (err) {
      setState('error');
      if (err instanceof LoftlyAPIError) {
        setError(err.message_en);
      } else if (err instanceof z.ZodError) {
        setError(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      } else if (err instanceof SyntaxError) {
        setError(`Invalid JSON: ${err.message}`);
      } else {
        setError((err as Error).message ?? 'Save failed');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Display name" required>
          <Input
            value={formValues.display_name}
            onChange={(e) => set('display_name', e.target.value)}
            required
          />
        </Field>
        <Field label="Slug">
          <Input
            value={formValues.slug}
            onChange={(e) => set('slug', e.target.value)}
            placeholder="auto from display_name"
          />
        </Field>
        <Field label="Bank slug" required>
          <Input
            value={formValues.bank_slug}
            onChange={(e) => set('bank_slug', e.target.value)}
            required
          />
        </Field>
        <Field label="Tier">
          <Input
            value={formValues.tier}
            onChange={(e) => set('tier', e.target.value)}
          />
        </Field>
        <Field label="Network" required>
          <Input
            value={formValues.network}
            onChange={(e) => set('network', e.target.value)}
            required
          />
        </Field>
        <Field label="Annual fee (THB)">
          <Input
            type="number"
            value={formValues.annual_fee_thb}
            onChange={(e) => set('annual_fee_thb', e.target.value)}
          />
        </Field>
        <Field label="Annual fee waiver">
          <Input
            value={formValues.annual_fee_waiver}
            onChange={(e) => set('annual_fee_waiver', e.target.value)}
          />
        </Field>
        <Field label="Min income (THB)">
          <Input
            type="number"
            value={formValues.min_income_thb}
            onChange={(e) => set('min_income_thb', e.target.value)}
          />
        </Field>
        <Field label="Min age">
          <Input
            type="number"
            value={formValues.min_age}
            onChange={(e) => set('min_age', e.target.value)}
          />
        </Field>
        <Field label="Earn currency code" required>
          <Input
            value={formValues.earn_currency_code}
            onChange={(e) => set('earn_currency_code', e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Earn rate local (JSON)">
        <JsonTextarea
          value={formValues.earn_rate_local}
          onChange={(v) => set('earn_rate_local', v)}
        />
      </Field>

      <Field label="Earn rate foreign (JSON — optional)">
        <JsonTextarea
          value={formValues.earn_rate_foreign}
          onChange={(v) => set('earn_rate_foreign', v)}
        />
      </Field>

      <Field label="Benefits (JSON)">
        <JsonTextarea
          value={formValues.benefits}
          onChange={(v) => set('benefits', v)}
        />
      </Field>

      <Field label="Signup bonus (JSON — optional)">
        <JsonTextarea
          value={formValues.signup_bonus}
          onChange={(v) => set('signup_bonus', v)}
          placeholder='{"bonus_points": 25000, "spend_required": 50000, "timeframe_days": 90}'
        />
      </Field>

      <Field label="Description (Thai)">
        <textarea
          className="h-24 w-full rounded-md border border-loftly-divider p-2 text-sm"
          value={formValues.description_th}
          onChange={(e) => set('description_th', e.target.value)}
        />
      </Field>

      <Field label="Description (English)">
        <textarea
          className="h-24 w-full rounded-md border border-loftly-divider p-2 text-sm"
          value={formValues.description_en}
          onChange={(e) => set('description_en', e.target.value)}
        />
      </Field>

      <Field label="Status" required>
        <select
          className="h-10 rounded-md border border-loftly-divider px-2 text-sm"
          value={formValues.status}
          onChange={(e) => set('status', e.target.value as CardStatus)}
        >
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="archived">archived</option>
        </select>
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-loftly-danger/10 p-3 text-sm text-loftly-danger"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === 'saving'}
          className="rounded-md bg-loftly-teal px-4 py-2 text-sm font-medium text-white hover:bg-loftly-teal/90 disabled:opacity-50"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-loftly-ink">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function JsonTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className="h-32 w-full rounded-md border border-loftly-divider p-2 font-mono text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
    />
  );
}

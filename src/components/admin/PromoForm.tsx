'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  createAdminPromo,
  updateAdminPromo,
  type PromoUpsert,
} from '@/lib/api/admin';
import type { Promo } from '@/lib/api/types';
import { Input } from '@/components/ui/input';
import { LoftlyAPIError } from '@/lib/api/client';

const PROMO_TYPES: Promo['promo_type'][] = [
  'category_bonus',
  'cashback',
  'transfer_bonus',
  'signup',
  'statement_credit',
  'dining_program',
];

const schema = z.object({
  bank_slug: z.string().min(1),
  source_url: z.string().url(),
  promo_type: z.enum([
    'category_bonus',
    'cashback',
    'transfer_bonus',
    'signup',
    'statement_credit',
    'dining_program',
  ]),
  title_th: z.string().min(1),
  title_en: z.string().nullable().optional(),
  description_th: z.string().nullable().optional(),
  merchant_name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  discount_type: z.string().nullable().optional(),
  discount_value: z.string().nullable().optional(),
  discount_amount: z.number().nullable().optional(),
  discount_unit: z.string().nullable().optional(),
  minimum_spend: z.number().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  card_ids: z.array(z.string()).optional(),
  active: z.boolean(),
});

interface Props {
  promo?: Promo;
  accessToken: string;
}

export function PromoForm({ promo, accessToken }: Props) {
  const router = useRouter();
  const [st, setSt] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const readOnly = Boolean(promo?.external_source_id);

  const [form, setForm] = React.useState({
    bank_slug: promo?.bank_slug ?? '',
    source_url: promo?.source_url ?? '',
    promo_type: promo?.promo_type ?? ('category_bonus' as Promo['promo_type']),
    title_th: promo?.title_th ?? '',
    title_en: promo?.title_en ?? '',
    description_th: promo?.description_th ?? '',
    merchant_name: promo?.merchant_name ?? '',
    category: promo?.category ?? '',
    discount_type: promo?.discount_type ?? '',
    discount_value: promo?.discount_value ?? '',
    discount_amount:
      promo?.discount_amount != null ? String(promo.discount_amount) : '',
    discount_unit: promo?.discount_unit ?? '',
    minimum_spend:
      promo?.minimum_spend != null ? String(promo.minimum_spend) : '',
    valid_from: promo?.valid_from ?? '',
    valid_until: promo?.valid_until ?? '',
    card_ids: (promo?.card_ids ?? []).join(', '),
    active: promo?.active ?? true,
  });

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSt('saving');
    setError(null);
    try {
      const payload: PromoUpsert = schema.parse({
        bank_slug: form.bank_slug,
        source_url: form.source_url,
        promo_type: form.promo_type,
        title_th: form.title_th,
        title_en: form.title_en || null,
        description_th: form.description_th || null,
        merchant_name: form.merchant_name || null,
        category: form.category || null,
        discount_type: form.discount_type || null,
        discount_value: form.discount_value || null,
        discount_amount: form.discount_amount
          ? Number(form.discount_amount)
          : null,
        discount_unit: form.discount_unit || null,
        minimum_spend: form.minimum_spend ? Number(form.minimum_spend) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        card_ids: form.card_ids
          ? form.card_ids
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        active: form.active,
      });

      if (promo) {
        await updateAdminPromo(promo.id, payload, accessToken);
      } else {
        await createAdminPromo(payload, accessToken);
      }
      router.push('/admin/promos');
      router.refresh();
    } catch (err) {
      setSt('error');
      if (err instanceof LoftlyAPIError) setError(err.message_en);
      else if (err instanceof z.ZodError)
        setError(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      else setError((err as Error).message ?? 'Save failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {readOnly && (
        <p className="rounded-md bg-loftly-amber/15 p-3 text-sm text-loftly-amber-urgent">
          Synced from external source — editing key fields is disabled to
          prevent drift.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Bank slug" required>
          <Input
            value={form.bank_slug}
            onChange={(e) => upd('bank_slug', e.target.value)}
            required
            disabled={readOnly}
          />
        </Field>
        <Field label="Source URL" required>
          <Input
            value={form.source_url}
            onChange={(e) => upd('source_url', e.target.value)}
            required
            disabled={readOnly}
          />
        </Field>
        <Field label="Promo type" required>
          <select
            className="h-10 rounded-md border border-loftly-divider px-2 text-sm"
            value={form.promo_type}
            onChange={(e) =>
              upd('promo_type', e.target.value as Promo['promo_type'])
            }
            disabled={readOnly}
          >
            {PROMO_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Merchant">
          <Input
            value={form.merchant_name}
            onChange={(e) => upd('merchant_name', e.target.value)}
          />
        </Field>
        <Field label="Category">
          <Input
            value={form.category}
            onChange={(e) => upd('category', e.target.value)}
          />
        </Field>
        <Field label="Valid from">
          <Input
            type="date"
            value={form.valid_from}
            onChange={(e) => upd('valid_from', e.target.value)}
          />
        </Field>
        <Field label="Valid until">
          <Input
            type="date"
            value={form.valid_until}
            onChange={(e) => upd('valid_until', e.target.value)}
          />
        </Field>
        <Field label="Minimum spend (THB)">
          <Input
            type="number"
            value={form.minimum_spend}
            onChange={(e) => upd('minimum_spend', e.target.value)}
          />
        </Field>
        <Field label="Discount value">
          <Input
            value={form.discount_value}
            onChange={(e) => upd('discount_value', e.target.value)}
          />
        </Field>
        <Field label="Discount amount">
          <Input
            type="number"
            value={form.discount_amount}
            onChange={(e) => upd('discount_amount', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Title (Thai)" required>
        <Input
          value={form.title_th}
          onChange={(e) => upd('title_th', e.target.value)}
          required
          disabled={readOnly}
        />
      </Field>
      <Field label="Title (English)">
        <Input
          value={form.title_en}
          onChange={(e) => upd('title_en', e.target.value)}
        />
      </Field>

      <Field label="Description (Thai)">
        <textarea
          className="h-24 w-full rounded-md border border-loftly-divider p-2 text-sm"
          value={form.description_th}
          onChange={(e) => upd('description_th', e.target.value)}
        />
      </Field>

      <Field label="Card IDs (comma-separated UUIDs)">
        <Input
          value={form.card_ids}
          onChange={(e) => upd('card_ids', e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => upd('active', e.target.checked)}
        />
        Active
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-loftly-danger/10 p-3 text-sm text-loftly-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={st === 'saving'}
        className="rounded-md bg-loftly-baht px-4 py-2 text-sm font-medium text-white hover:bg-loftly-baht/90 disabled:opacity-50"
      >
        {st === 'saving' ? 'Saving…' : 'Save'}
      </button>
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

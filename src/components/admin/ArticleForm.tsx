'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import {
  createAdminArticle,
  updateAdminArticle,
  type Article,
  type ArticleState,
  type ArticleType,
  type ArticleUpsert,
} from '@/lib/api/admin';
import { Input } from '@/components/ui/input';
import { LoftlyAPIError } from '@/lib/api/client';

const schema = z.object({
  slug: z.string().min(1).optional(),
  card_id: z.string().nullable().optional(),
  article_type: z.enum(['card_review', 'guide', 'news', 'comparison']),
  title_th: z.string().min(1),
  title_en: z.string().nullable().optional(),
  summary_th: z.string().min(1),
  summary_en: z.string().nullable().optional(),
  body_th: z.string().min(1),
  body_en: z.string().nullable().optional(),
  best_for_tags: z.array(z.string()),
  state: z.enum(['draft', 'review', 'published', 'archived']),
  seo_meta: z.record(z.unknown()).optional(),
});

interface Props {
  article?: Article;
  accessToken: string;
}

const STATES: ArticleState[] = ['draft', 'review', 'published', 'archived'];

function nextStates(current: ArticleState): ArticleState[] {
  switch (current) {
    case 'draft':
      return ['review', 'published'];
    case 'review':
      return ['draft', 'published'];
    case 'published':
      return ['archived'];
    case 'archived':
      return ['draft'];
  }
}

export function ArticleForm({ article, accessToken }: Props) {
  const router = useRouter();
  const [state, setState] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    slug: article?.slug ?? '',
    card_id: article?.card_id ?? '',
    article_type: article?.article_type ?? ('card_review' as ArticleType),
    title_th: article?.title_th ?? '',
    title_en: article?.title_en ?? '',
    summary_th: article?.summary_th ?? '',
    summary_en: article?.summary_en ?? '',
    body_th: article?.body_th ?? '',
    body_en: article?.body_en ?? '',
    best_for_tags: (article?.best_for_tags ?? []).join(', '),
    currentState: article?.state ?? ('draft' as ArticleState),
  });

  const [previewLang, setPreviewLang] = React.useState<'th' | 'en'>('th');

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function save(targetState: ArticleState) {
    setState('saving');
    setError(null);
    try {
      const payload: ArticleUpsert = schema.parse({
        slug: form.slug || undefined,
        card_id: form.card_id || null,
        article_type: form.article_type,
        title_th: form.title_th,
        title_en: form.title_en || null,
        summary_th: form.summary_th,
        summary_en: form.summary_en || null,
        body_th: form.body_th,
        body_en: form.body_en || null,
        best_for_tags: form.best_for_tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        state: targetState,
      });

      if (article) {
        await updateAdminArticle(article.id, payload, accessToken);
      } else {
        await createAdminArticle(payload, accessToken);
      }
      router.push('/admin/articles');
      router.refresh();
    } catch (err) {
      setState('error');
      if (err instanceof LoftlyAPIError) setError(err.message_en);
      else if (err instanceof z.ZodError)
        setError(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      else setError((err as Error).message ?? 'Save failed');
    }
  }

  const transitions = nextStates(form.currentState);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(form.currentState);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Slug">
          <Input
            value={form.slug}
            onChange={(e) => upd('slug', e.target.value)}
            placeholder="auto from title"
          />
        </Field>
        <Field label="Card ID (if review)">
          <Input
            value={form.card_id}
            onChange={(e) => upd('card_id', e.target.value)}
          />
        </Field>
        <Field label="Article type" required>
          <select
            className="h-10 rounded-md border border-loftly-divider px-2 text-sm"
            value={form.article_type}
            onChange={(e) => upd('article_type', e.target.value as ArticleType)}
          >
            <option value="card_review">card_review</option>
            <option value="guide">guide</option>
            <option value="news">news</option>
            <option value="comparison">comparison</option>
          </select>
        </Field>
        <Field label="State" required>
          <select
            className="h-10 rounded-md border border-loftly-divider px-2 text-sm"
            value={form.currentState}
            onChange={(e) =>
              upd('currentState', e.target.value as ArticleState)
            }
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Title (Thai)" required>
        <Input
          value={form.title_th}
          onChange={(e) => upd('title_th', e.target.value)}
          required
        />
      </Field>
      <Field label="Title (English)">
        <Input
          value={form.title_en}
          onChange={(e) => upd('title_en', e.target.value)}
        />
      </Field>

      <Field label="Summary (Thai)" required>
        <textarea
          className="h-20 w-full rounded-md border border-loftly-divider p-2 text-sm"
          value={form.summary_th}
          onChange={(e) => upd('summary_th', e.target.value)}
          required
        />
      </Field>
      <Field label="Summary (English)">
        <textarea
          className="h-20 w-full rounded-md border border-loftly-divider p-2 text-sm"
          value={form.summary_en}
          onChange={(e) => upd('summary_en', e.target.value)}
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-loftly-ink">
            Body (Markdown)
          </span>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              className={
                previewLang === 'th'
                  ? 'rounded bg-slate-900 px-2 py-1 text-white'
                  : 'rounded border border-loftly-divider px-2 py-1 text-loftly-ink'
              }
              onClick={() => setPreviewLang('th')}
            >
              TH
            </button>
            <button
              type="button"
              className={
                previewLang === 'en'
                  ? 'rounded bg-slate-900 px-2 py-1 text-white'
                  : 'rounded border border-loftly-divider px-2 py-1 text-loftly-ink'
              }
              onClick={() => setPreviewLang('en')}
            >
              EN
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea
            className="h-80 w-full rounded-md border border-loftly-divider p-2 font-mono text-sm"
            value={previewLang === 'th' ? form.body_th : form.body_en}
            onChange={(e) =>
              previewLang === 'th'
                ? upd('body_th', e.target.value)
                : upd('body_en', e.target.value)
            }
            placeholder={previewLang === 'th' ? 'Markdown body (Thai)' : 'Markdown body (English)'}
          />
          <div
            className="h-80 overflow-auto rounded-md border border-loftly-divider bg-loftly-teal-soft/40 p-3 text-sm"
            aria-label="Markdown preview"
          >
            <pre className="whitespace-pre-wrap text-xs text-loftly-ink">
              {previewLang === 'th' ? form.body_th : form.body_en ||
                '(empty)'}
            </pre>
          </div>
        </div>
      </div>

      <Field label="Best-for tags (comma separated)">
        <Input
          value={form.best_for_tags}
          onChange={(e) => upd('best_for_tags', e.target.value)}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-md bg-loftly-danger/10 p-3 text-sm text-loftly-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={state === 'saving'}
          className="rounded-md bg-loftly-teal px-4 py-2 text-sm font-medium text-white hover:bg-loftly-teal/90 disabled:opacity-50"
        >
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>

        {article && transitions.length > 0 && (
          <span className="ml-3 flex flex-wrap items-center gap-2 text-sm text-loftly-ink-muted">
            Transition →
            {transitions.map((st) => (
              <button
                key={st}
                type="button"
                disabled={state === 'saving'}
                onClick={() => void save(st)}
                className="rounded-md border border-loftly-divider px-3 py-1.5 text-xs hover:bg-loftly-teal-soft/40 disabled:opacity-50"
              >
                {st}
              </button>
            ))}
          </span>
        )}
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

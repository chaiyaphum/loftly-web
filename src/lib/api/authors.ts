import { apiFetch } from './client';

/**
 * Author profile helpers — mirrors `GET /v1/authors/{slug}` on `loftly-api`.
 *
 * Consumed server-side by `ArticleByline` (and anything else that needs to
 * resolve a display byline). Cached for an hour because author rows change
 * rarely and the endpoint payload is tiny.
 *
 * The 404 case is surfaced as a `LoftlyAPIError` with `status=404`; callers
 * typically catch it and fall back to the default "Loftly" byline rather
 * than propagating the error up to the page.
 */

export type AuthorRole = 'founder' | 'contractor' | 'organization' | string;

export interface Author {
  id: string;
  slug: string;
  display_name: string;
  display_name_en?: string | null;
  bio_th?: string | null;
  bio_en?: string | null;
  role?: AuthorRole | null;
  image_url?: string | null;
  created_at: string;
}

export function getAuthor(
  slug: string,
  opts: { revalidate?: number | false; signal?: AbortSignal } = {},
): Promise<Author> {
  return apiFetch<Author>(`/authors/${encodeURIComponent(slug)}`, {
    method: 'GET',
    accessToken: null,
    // Authors change rarely — 1h default matches the editorial cadence.
    revalidate: opts.revalidate ?? 3600,
    signal: opts.signal,
  });
}

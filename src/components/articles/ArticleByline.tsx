import { getTranslations } from 'next-intl/server';
import type { getTranslations as getTranslationsType } from 'next-intl/server';
import { getAuthor } from '@/lib/api/authors';
import { LoftlyAPIError } from '@/lib/api/client';
type Tx = Awaited<ReturnType<typeof getTranslationsType>>;

type Props = {
  /** ISO timestamp for published_at. */
  publishedAt: string;
  /** ISO timestamp for updated_at (optional — only shown if > 30 days past publishedAt). */
  updatedAt?: string | null;
  /** Reading time in minutes (use `estimateReadingMinutes` from lib). */
  readingMinutes: number;
  /** Author display name — defaults to "Loftly" (Organization byline). Takes
   *  precedence over `authorSlug` when both are provided (so callers can skip
   *  the server fetch entirely if they already have the name). */
  authorName?: string;
  /** Author slug — when provided (and `authorName` is not), the component
   *  fetches `/v1/authors/{slug}` server-side and renders the locale-aware
   *  display name. Falls back to the "Loftly" default on any error (404,
   *  network) so the byline never breaks the page. */
  authorSlug?: string | null;
  /** BCP 47 locale used for absolute-date formatting + `display_name_en`
   *  preference. */
  locale?: 'th' | 'en';
};

const DEFAULT_AUTHOR_NAME = 'Loftly';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY);
}

function formatRelativeDay(date: Date, t: Tx): string {
  const now = new Date();
  const days = daysBetween(date, now);
  if (days === 0) return t('relativeToday');
  if (days === 1) return t('relativeYesterday');
  if (days < 30) return t('relativeDaysAgo', { days });
  return date.toLocaleDateString();
}

/**
 * Resolve the byline name.
 *
 * Priority:
 *  1. Explicit `authorName` prop — caller already knows the name.
 *  2. Fetch `/v1/authors/{slug}` — prefer `display_name_en` when locale is
 *     'en' and it's non-null, otherwise fall back to `display_name`.
 *  3. Default to `"Loftly"` on any error (404 unknown slug, network failure,
 *     etc.) — the byline should never crash the page.
 */
async function resolveAuthorName(
  authorName: string | undefined,
  authorSlug: string | null | undefined,
  locale: 'th' | 'en',
): Promise<string> {
  if (authorName) return authorName;
  if (!authorSlug) return DEFAULT_AUTHOR_NAME;
  try {
    const author = await getAuthor(authorSlug);
    if (locale === 'en' && author.display_name_en) {
      return author.display_name_en;
    }
    return author.display_name || DEFAULT_AUTHOR_NAME;
  } catch (err) {
    // 404 / network — fall through to the default so the page still renders.
    // Only log non-404 errors (404 is expected during the pre-seed window).
    if (!(err instanceof LoftlyAPIError) || err.status !== 404) {
      console.warn('[ArticleByline] getAuthor failed; defaulting', err);
    }
    return DEFAULT_AUTHOR_NAME;
  }
}

export async function ArticleByline({
  publishedAt,
  updatedAt,
  readingMinutes,
  authorName,
  authorSlug,
  locale = 'th',
}: Props) {
  const t = await getTranslations('article.byline');
  const resolvedName = await resolveAuthorName(authorName, authorSlug, locale);
  const publishedDate = new Date(publishedAt);
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const showUpdated = updatedDate && daysBetween(publishedDate, updatedDate) >= 30;

  const dateFmt = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"
      data-testid="article-byline"
    >
      <span>{t('author', { name: resolvedName })}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={publishedAt} title={publishedAt}>
        {t('published', { date: dateFmt.format(publishedDate) })} · {formatRelativeDay(publishedDate, t)}
      </time>
      {showUpdated && updatedDate && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={updatedAt ?? undefined} title={updatedAt ?? undefined}>
            {t('updated', { date: dateFmt.format(updatedDate) })}
          </time>
        </>
      )}
      <span aria-hidden="true">·</span>
      <span>{t('readingTime', { minutes: readingMinutes })}</span>
    </div>
  );
}

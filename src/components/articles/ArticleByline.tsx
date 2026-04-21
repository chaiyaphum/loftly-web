import { getTranslations } from 'next-intl/server';
import type { getTranslations as getTranslationsType } from 'next-intl/server';
type Tx = Awaited<ReturnType<typeof getTranslationsType>>;

type Props = {
  /** ISO timestamp for published_at. */
  publishedAt: string;
  /** ISO timestamp for updated_at (optional — only shown if > 30 days past publishedAt). */
  updatedAt?: string | null;
  /** Reading time in minutes (use `estimateReadingMinutes` from lib). */
  readingMinutes: number;
  /** Author display name — defaults to "Loftly" (Organization byline). */
  authorName?: string;
  /** BCP 47 locale used for absolute-date formatting. */
  locale?: 'th' | 'en';
};

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

export async function ArticleByline({
  publishedAt,
  updatedAt,
  readingMinutes,
  authorName = 'Loftly',
  locale = 'th',
}: Props) {
  const t = await getTranslations('article.byline');
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
      <span>{t('author', { name: authorName })}</span>
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

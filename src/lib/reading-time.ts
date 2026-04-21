/**
 * Reading-time estimate for Thai + English article bodies.
 *
 * Thai is measured in characters (no word boundary):
 * - 200 chars/min is a conservative mass-reader baseline. Thai-specialist
 *   readers go faster, novice readers slower — 200 is the 50th percentile.
 *
 * English uses whitespace-split words:
 * - 250 words/min matches the widely-quoted adult-reader mean.
 *
 * Mixed content counts both and sums. Minimum floor is 1 minute.
 */

const CHARS_PER_MINUTE_TH = 200;
const WORDS_PER_MINUTE_EN = 250;

/** Returns estimated reading time in whole minutes (≥ 1). */
export function estimateReadingMinutes(text: string | null | undefined): number {
  if (!text) return 1;

  const thaiChars = (text.match(/[฀-๿]/g) ?? []).length;
  const nonThai = text.replace(/[฀-๿]/g, ' ');
  const englishWords = nonThai.trim() ? nonThai.trim().split(/\s+/).length : 0;

  const minutes = thaiChars / CHARS_PER_MINUTE_TH + englishWords / WORDS_PER_MINUTE_EN;
  return Math.max(1, Math.ceil(minutes));
}

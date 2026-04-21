import { describe, expect, test } from 'vitest';
import { estimateReadingMinutes } from './reading-time';

describe('estimateReadingMinutes', () => {
  test('returns 1 for empty / null / undefined', () => {
    expect(estimateReadingMinutes('')).toBe(1);
    expect(estimateReadingMinutes(null)).toBe(1);
    expect(estimateReadingMinutes(undefined)).toBe(1);
  });

  test('pure English at 250 wpm', () => {
    const words = 'word '.repeat(500).trim(); // 500 words → 2 min
    expect(estimateReadingMinutes(words)).toBe(2);
  });

  test('pure Thai at 200 chars/min', () => {
    const text = 'ก'.repeat(800); // 800 chars → 4 min
    expect(estimateReadingMinutes(text)).toBe(4);
  });

  test('mixed Thai + English sums both buckets', () => {
    const thai = 'ก'.repeat(400); // 2 min
    const english = 'word '.repeat(250).trim(); // 1 min
    expect(estimateReadingMinutes(thai + ' ' + english)).toBe(3);
  });

  test('rounds up — 30 chars still returns 1 min', () => {
    expect(estimateReadingMinutes('กขคง')).toBe(1);
  });
});

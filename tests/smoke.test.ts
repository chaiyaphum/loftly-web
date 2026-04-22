import { describe, it, expect } from 'vitest';
import { formatTHB } from '@/lib/utils';

describe('formatTHB', () => {
  it('prefixes with the ฿ glyph and uses th-TH grouping', () => {
    expect(formatTHB(80000)).toBe('฿80,000');
  });

  it('drops fractional baht (integers are the product convention)', () => {
    expect(formatTHB(1234.56)).toBe('฿1,235');
  });
});

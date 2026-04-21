import { describe, it, expect } from 'vitest';
import { formatTHB } from '@/lib/utils';

describe('formatTHB', () => {
  it('prefixes with "THB " and uses th-TH grouping', () => {
    expect(formatTHB(80000)).toBe('THB 80,000');
  });

  it('drops fractional baht (integers are the product convention)', () => {
    expect(formatTHB(1234.56)).toBe('THB 1,235');
  });
});

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  ThaiNumberFormat,
  formatTHBCompact,
  formatTHBFull,
} from '@/components/loftly/ThaiNumberFormat';

describe('ThaiNumberFormat helpers', () => {
  it('full format uses ฿ glyph + th-TH grouping', () => {
    expect(formatTHBFull(80000)).toBe('฿80,000');
    expect(formatTHBFull(1234567)).toBe('฿1,234,567');
  });

  it('compact format rounds into k / m suffix without ฿ prefix when hidden', () => {
    expect(formatTHBCompact(80_000, true)).toBe('80k');
    expect(formatTHBCompact(2_500_000, true)).toBe('2.5m');
    expect(formatTHBCompact(500, true)).toBe('500');
  });

  it('compact format keeps ฿ prefix by default', () => {
    expect(formatTHBCompact(80_000)).toBe('฿80k');
  });

  it('renders a span with tabular-nums class for alignment', () => {
    const { container } = render(<ThaiNumberFormat value={80000} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('tabular-nums');
    expect(span?.textContent).toBe('฿80,000');
  });
});

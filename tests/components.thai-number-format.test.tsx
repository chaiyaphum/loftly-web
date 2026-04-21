import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  ThaiNumberFormat,
  formatTHBCompact,
  formatTHBFull,
} from '@/components/loftly/ThaiNumberFormat';

describe('ThaiNumberFormat helpers', () => {
  it('full format uses THB prefix + th-TH grouping', () => {
    expect(formatTHBFull(80000)).toBe('THB 80,000');
    expect(formatTHBFull(1234567)).toBe('THB 1,234,567');
  });

  it('compact format rounds into k / m suffix without THB prefix when hidden', () => {
    expect(formatTHBCompact(80_000, true)).toBe('80k');
    expect(formatTHBCompact(2_500_000, true)).toBe('2.5m');
    expect(formatTHBCompact(500, true)).toBe('500');
  });

  it('compact format keeps THB prefix by default', () => {
    expect(formatTHBCompact(80_000)).toBe('THB 80k');
  });

  it('renders a span with tabular-nums class for alignment', () => {
    const { container } = render(<ThaiNumberFormat value={80000} />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('tabular-nums');
    expect(span?.textContent).toBe('THB 80,000');
  });
});

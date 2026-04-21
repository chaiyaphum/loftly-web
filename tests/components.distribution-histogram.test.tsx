import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DistributionHistogram } from '@/components/loftly/DistributionHistogram';

describe('DistributionHistogram', () => {
  it('renders one bar for each of p10/p25/p50/p75/p90', () => {
    const { container } = render(
      <DistributionHistogram
        distribution={{ p10: 0.4, p25: 0.6, p50: 0.9, p75: 1.2, p90: 1.5 }}
      />,
    );
    const bars = container.querySelectorAll('[data-percentile]');
    expect(bars.length).toBe(5);
    const percentiles = Array.from(bars).map((b) =>
      b.getAttribute('data-percentile'),
    );
    expect(percentiles).toEqual(['p10', 'p25', 'p50', 'p75', 'p90']);
  });

  it('scales bar heights relative to the max value', () => {
    const { getByTestId } = render(
      <DistributionHistogram
        distribution={{ p10: 0.5, p25: 1, p50: 1.5, p75: 2, p90: 4 }}
        width={200}
        height={80}
      />,
    );
    const top = getByTestId('histogram-bar-p90') as unknown as SVGRectElement;
    const bottom = getByTestId('histogram-bar-p10') as unknown as SVGRectElement;
    const topHeight = parseFloat(top.getAttribute('height') ?? '0');
    const bottomHeight = parseFloat(bottom.getAttribute('height') ?? '0');
    expect(topHeight).toBeGreaterThan(bottomHeight);
  });

  it('still renders safely when the distribution is null or missing keys', () => {
    const { container } = render(
      <DistributionHistogram distribution={null} />,
    );
    const bars = container.querySelectorAll('[data-percentile]');
    expect(bars.length).toBe(5);
  });
});

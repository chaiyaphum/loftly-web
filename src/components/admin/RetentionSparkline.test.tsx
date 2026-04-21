import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RetentionSparkline } from './RetentionSparkline';

/**
 * `RetentionSparkline` ships as inline SVG so we can unit-test the DOM shape
 * directly. Assertions focus on the invariants the page-level dashboard
 * depends on:
 *   - one `<circle>` data point per input value
 *   - `<svg role="img">` with an aria-label for a11y
 *   - missing / non-finite values don't crash rendering
 */
describe('RetentionSparkline', () => {
  it('renders one circle per point for a 12-week series', () => {
    const points = Array.from({ length: 12 }, (_, i) => 0.5 + i * 0.02);
    const { container } = render(
      <RetentionSparkline points={points} testId="spark" />,
    );

    expect(screen.getByTestId('spark')).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(12);
  });

  it('exposes an accessible label on the SVG', () => {
    render(<RetentionSparkline points={[0.1, 0.2, 0.3]} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('aria-label', '12-week retention sparkline');
  });

  it('accepts a custom aria-label for localised dashboards', () => {
    render(
      <RetentionSparkline
        points={[0.1, 0.2]}
        ariaLabel="Retention 12 สัปดาห์"
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Retention 12 สัปดาห์',
    );
  });

  it('renders without throwing when given an empty point set', () => {
    const { container } = render(<RetentionSparkline points={[]} />);
    // Empty series draws a baseline path but no point circles.
    expect(container.querySelector('path')).not.toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('coerces non-finite values to 0 instead of crashing', () => {
    const { container } = render(
      <RetentionSparkline points={[0.5, Number.NaN, 0.7]} />,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });
});

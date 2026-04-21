import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  bandForConfidence,
  ConfidenceBar,
} from '@/components/loftly/ConfidenceBar';

describe('ConfidenceBar', () => {
  it('renders a fill with width proportional to the value', () => {
    const { getByTestId } = render(<ConfidenceBar value={0.75} />);
    const fill = getByTestId('confidence-bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('75%');
  });

  it('clamps values outside [0, 1] to the nearest bound', () => {
    const { getByTestId, rerender } = render(<ConfidenceBar value={-0.5} />);
    expect((getByTestId('confidence-bar-fill') as HTMLElement).style.width).toBe(
      '0%',
    );
    rerender(<ConfidenceBar value={1.5} />);
    expect((getByTestId('confidence-bar-fill') as HTMLElement).style.width).toBe(
      '100%',
    );
  });

  it('tags the container with the confidence band per VALUATION_METHOD rules', () => {
    const { container, rerender } = render(<ConfidenceBar value={0.9} />);
    expect(
      container
        .querySelector('[data-confidence-band]')
        ?.getAttribute('data-confidence-band'),
    ).toBe('full');

    rerender(<ConfidenceBar value={0.65} />);
    expect(
      container
        .querySelector('[data-confidence-band]')
        ?.getAttribute('data-confidence-band'),
    ).toBe('tooltip');

    rerender(<ConfidenceBar value={0.5} />);
    expect(
      container
        .querySelector('[data-confidence-band]')
        ?.getAttribute('data-confidence-band'),
    ).toBe('directional');

    rerender(<ConfidenceBar value={0.3} />);
    expect(
      container
        .querySelector('[data-confidence-band]')
        ?.getAttribute('data-confidence-band'),
    ).toBe('range');
  });

  it('bandForConfidence exposes the banding function for downstream consumers', () => {
    expect(bandForConfidence(0.81)).toBe('full');
    expect(bandForConfidence(0.6)).toBe('tooltip');
    expect(bandForConfidence(0.45)).toBe('directional');
    expect(bandForConfidence(0)).toBe('range');
  });
});

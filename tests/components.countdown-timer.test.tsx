import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { CountdownTimer } from '@/components/loftly/CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders d/h/m remaining until the target (no seconds by default)', () => {
    // 3 days, 4 hours, 5 minutes, 6 seconds from fake now.
    const target = new Date('2026-04-24T04:05:06Z').toISOString();
    const { getByTestId } = render(<CountdownTimer targetIso={target} />);
    const node = getByTestId('countdown-remaining');
    expect(node.textContent).toBe('3d 4h 5m');
  });

  it('decrements each second when seconds are shown', () => {
    const target = new Date('2026-04-21T00:00:10Z').toISOString();
    const { getByTestId } = render(
      <CountdownTimer targetIso={target} showSeconds />,
    );
    const initial = getByTestId('countdown-remaining').getAttribute(
      'data-countdown-seconds',
    );
    expect(initial).toBe('10');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const later = getByTestId('countdown-remaining').getAttribute(
      'data-countdown-seconds',
    );
    expect(later).toBe('7');
  });

  it('renders the expired label once the target is in the past', () => {
    const target = new Date('2026-04-20T00:00:00Z').toISOString();
    const { getByTestId } = render(
      <CountdownTimer
        targetIso={target}
        labels={{ expired: 'expired' }}
      />,
    );
    expect(getByTestId('countdown-expired').textContent).toBe('expired');
  });

  it('gracefully handles an invalid target ISO', () => {
    const { getByTestId } = render(<CountdownTimer targetIso="not-a-date" />);
    expect(getByTestId('countdown-invalid').textContent).toBe('—');
  });
});

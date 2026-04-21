import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { GoalPicker } from '@/components/loftly/GoalPicker';
import type { SelectorGoal } from '@/lib/api/types';
import thMessages from '../messages/th.json';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('GoalPicker', () => {
  it('renders the 3 goal radios and marks the current value as checked', () => {
    const value: SelectorGoal = {
      type: 'miles',
      currency_preference: 'ROP',
      horizon_months: 12,
      target_points: 90_000,
    };
    render(wrap(<GoalPicker value={value} onChange={vi.fn()} />));

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const miles = screen.getByLabelText(/ไมล์ไปต่างประเทศ/);
    expect(miles).toBeChecked();
  });

  it('shows currency / horizon / target-points fields when goal.type is miles', () => {
    const value: SelectorGoal = {
      type: 'miles',
      currency_preference: 'ROP',
      horizon_months: 12,
      target_points: 90_000,
    };
    render(wrap(<GoalPicker value={value} onChange={vi.fn()} />));

    expect(screen.getByLabelText(/สกุลแต้ม/)).toBeInTheDocument();
    expect(screen.getByLabelText(/กรอบเวลา/)).toBeInTheDocument();
    expect(screen.getByLabelText(/แต้มเป้าหมาย/)).toBeInTheDocument();
  });

  it('hides contextual fields when goal.type is cashback', () => {
    const value: SelectorGoal = { type: 'cashback' };
    render(wrap(<GoalPicker value={value} onChange={vi.fn()} />));

    expect(screen.queryByLabelText(/สกุลแต้ม/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/กรอบเวลา/)).not.toBeInTheDocument();
  });

  it('emits a miles-shaped goal with defaults when switching to miles', () => {
    const onChange = vi.fn();
    const value: SelectorGoal = { type: 'cashback' };
    render(wrap(<GoalPicker value={value} onChange={onChange} />));

    const miles = screen.getByLabelText(/ไมล์ไปต่างประเทศ/);
    act(() => {
      fireEvent.click(miles);
    });
    const last = onChange.mock.calls.at(-1)?.[0] as SelectorGoal;
    expect(last.type).toBe('miles');
    expect(last.currency_preference).toBe('ROP');
    expect(last.horizon_months).toBe(12);
    expect(last.target_points).toBeGreaterThan(0);
  });

  it('emits cleanly-typed cashback when user picks cashback', () => {
    const onChange = vi.fn();
    const value: SelectorGoal = {
      type: 'miles',
      currency_preference: 'ROP',
      horizon_months: 12,
      target_points: 90_000,
    };
    render(wrap(<GoalPicker value={value} onChange={onChange} />));

    const cashback = screen.getByLabelText(/เงินคืน/);
    act(() => {
      fireEvent.click(cashback);
    });
    const last = onChange.mock.calls.at(-1)?.[0] as SelectorGoal;
    expect(last).toEqual({ type: 'cashback' });
  });
});

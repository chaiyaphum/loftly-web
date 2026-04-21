import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SpendCategorySliders } from '@/components/loftly/SpendCategorySliders';
import type { SpendCategoriesForm } from '@/lib/schemas/selector';
import thMessages from '../messages/th.json';

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function baseCats(overrides: Partial<SpendCategoriesForm> = {}): SpendCategoriesForm {
  return {
    dining: 15_000,
    online: 20_000,
    travel: 25_000,
    grocery: 10_000,
    other: 10_000,
    ...overrides,
  };
}

describe('SpendCategorySliders', () => {
  it('renders one slider per UI category with labels and current THB values', () => {
    render(
      wrap(
        <SpendCategorySliders
          total={80_000}
          categories={baseCats()}
          onChange={vi.fn()}
        />,
      ),
    );

    // 5 sliders total; `other` is disabled (auto-residual).
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(5);
    expect(screen.getByTestId('spend-value-dining').textContent).toBe('THB 15,000');
    expect(screen.getByTestId('spend-value-other').textContent).toBe('THB 10,000');
  });

  it('reallocates residual to `other` when one slider moves', () => {
    const onChange = vi.fn();
    render(
      wrap(
        <SpendCategorySliders
          total={80_000}
          categories={baseCats()}
          onChange={onChange}
        />,
      ),
    );

    const dining = screen.getByLabelText('ร้านอาหาร');
    act(() => {
      fireEvent.change(dining, { target: { value: '20000' } });
    });

    // Was 15k → 20k, other was 10k → should drop by 5k to 5k.
    const last = onChange.mock.calls.at(-1)?.[0] as SpendCategoriesForm;
    expect(last.dining).toBe(20_000);
    expect(last.other).toBe(5_000);
    // Sum still equals total.
    const sum = last.dining + last.online + last.travel + last.grocery + last.other;
    expect(sum).toBe(80_000);
  });

  it('clamps `other` to 0 when sliders over-allocate', () => {
    const onChange = vi.fn();
    // Editable cats sum = 15+20+25+10 = 70k; other = 10k → total 80k
    render(
      wrap(
        <SpendCategorySliders
          total={80_000}
          categories={baseCats()}
          onChange={onChange}
        />,
      ),
    );

    // Pull dining all the way to 80k — other should clamp to 0.
    const dining = screen.getByLabelText('ร้านอาหาร');
    act(() => {
      fireEvent.change(dining, { target: { value: '80000' } });
    });
    const last = onChange.mock.calls.at(-1)?.[0] as SpendCategoriesForm;
    expect(last.dining).toBeLessThanOrEqual(80_000);
    expect(last.other).toBe(0);
  });

  it('disables the `other` slider (auto-residual, no keyboard change)', () => {
    render(
      wrap(
        <SpendCategorySliders
          total={80_000}
          categories={baseCats()}
          onChange={vi.fn()}
        />,
      ),
    );

    const other = screen.getByLabelText('อื่น ๆ');
    expect(other).toBeDisabled();
  });

  it('uses the native range step so arrow keys move by THB 1,000', () => {
    render(
      wrap(
        <SpendCategorySliders
          total={80_000}
          categories={baseCats()}
          onChange={vi.fn()}
        />,
      ),
    );
    const dining = screen.getByLabelText('ร้านอาหาร');
    expect(dining).toHaveAttribute('step', '1000');
    expect(dining).toHaveAttribute('max', '80000');
  });
});

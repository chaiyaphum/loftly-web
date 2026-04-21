import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BankCoverageBadge } from './BankCoverageBadge';

/**
 * Visual + semantic checks for the coverage badge. We assert colour via the
 * Tailwind class list rather than rendered CSS because the unit harness
 * doesn't carry the Tailwind JIT pipeline — the classes themselves are the
 * contract.
 */

describe('BankCoverageBadge', () => {
  it('renders the supplied label', () => {
    render(<BankCoverageBadge status="full" label="Full coverage" testId="b" />);
    expect(screen.getByTestId('b')).toHaveTextContent('Full coverage');
  });

  it('applies emerald classes when status is full', () => {
    render(<BankCoverageBadge status="full" label="Full" testId="b" />);
    const el = screen.getByTestId('b');
    expect(el).toHaveAttribute('data-status', 'full');
    expect(el.className).toContain('bg-emerald-50');
    expect(el.className).toContain('text-emerald-700');
  });

  it('applies amber classes when status is partial', () => {
    render(<BankCoverageBadge status="partial" label="Partial" testId="b" />);
    const el = screen.getByTestId('b');
    expect(el).toHaveAttribute('data-status', 'partial');
    expect(el.className).toContain('bg-amber-50');
    expect(el.className).toContain('text-amber-800');
  });

  it('applies red classes when status is gap', () => {
    render(<BankCoverageBadge status="gap" label="Gap" testId="b" />);
    const el = screen.getByTestId('b');
    expect(el).toHaveAttribute('data-status', 'gap');
    expect(el.className).toContain('bg-red-50');
    expect(el.className).toContain('text-red-700');
  });
});

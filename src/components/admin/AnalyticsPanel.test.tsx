import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPanel } from './AnalyticsPanel';

/**
 * Unit coverage for `AnalyticsPanel` — the generic KPI card used across the
 * admin analytics dashboard (W23). We verify:
 *   - the hero value renders verbatim (caller owns formatting)
 *   - positive deltas get the emerald "up" pill and a `+` sign
 *   - negative deltas get the red "down" pill without double-signing the minus
 *   - `delta === 0` / `null` / `undefined` suppresses the pill entirely so the
 *     layout doesn't flicker between states
 *   - the `footer` slot is rendered when supplied
 */
describe('AnalyticsPanel', () => {
  it('renders title and hero value, no delta pill when delta is null', () => {
    render(
      <AnalyticsPanel
        title="Users"
        value="12,345"
        delta={null}
        testId="panel-users"
      />,
    );

    expect(screen.getByTestId('panel-users')).toBeInTheDocument();
    expect(screen.getByTestId('panel-users-value')).toHaveTextContent('12,345');
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-users-delta')).not.toBeInTheDocument();
  });

  it('renders a positive delta pill with +sign and up-arrow sr text', () => {
    render(
      <AnalyticsPanel
        title="Selector"
        value="1,200"
        delta={12.5}
        testId="panel-selector"
      />,
    );

    const pill = screen.getByTestId('panel-selector-delta');
    expect(pill).toHaveTextContent('+12.5%');
    // Screen-reader text tells direction without relying on colour.
    expect(pill).toHaveTextContent('Up from previous period');
    expect(pill.className).toContain('loftly-teal');
  });

  it('renders a negative delta pill without adding a second minus sign', () => {
    render(
      <AnalyticsPanel
        title="LLM costs"
        value="THB 5,000"
        delta={-3}
        testId="panel-llm"
      />,
    );

    const pill = screen.getByTestId('panel-llm-delta');
    // `-3.0%` — a single leading minus produced by `toFixed(1)`.
    expect(pill).toHaveTextContent('-3.0%');
    expect(pill.textContent).not.toContain('--');
    expect(pill).toHaveTextContent('Down from previous period');
    expect(pill.className).toContain('loftly-danger');
  });

  it('renders the footer slot when provided', () => {
    render(
      <AnalyticsPanel
        title="Content"
        value="42"
        footer={<span data-testid="custom-footer">footer-content</span>}
      />,
    );

    expect(screen.getByTestId('custom-footer')).toHaveTextContent(
      'footer-content',
    );
  });

  it('treats delta=0 as "no change" and hides the pill', () => {
    render(
      <AnalyticsPanel
        title="System"
        value="99.99%"
        delta={0}
        testId="panel-system"
      />,
    );
    expect(screen.queryByTestId('panel-system-delta')).not.toBeInTheDocument();
  });
});

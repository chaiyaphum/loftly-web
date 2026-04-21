import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountCard } from './AccountCard';

describe('AccountCard', () => {
  it('renders the title, description, and CTA text', () => {
    render(
      <AccountCard
        href="/account/consent"
        title="Data consents"
        description="Review which data uses you've allowed."
        cta="Manage consents"
        testId="card-consent"
      />,
    );

    const card = screen.getByTestId('card-consent');
    expect(card).toHaveTextContent('Data consents');
    expect(card).toHaveTextContent(/Review which data uses/);
    expect(card).toHaveTextContent('Manage consents');
  });

  it('links the whole card to the supplied href', () => {
    render(
      <AccountCard
        href="/account/delete"
        title="Delete account"
        description="Start the 14-day grace period."
        cta="Delete account"
        testId="card-delete"
        tone="danger"
      />,
    );

    const card = screen.getByTestId('card-delete');
    expect(card.tagName).toBe('A');
    expect(card).toHaveAttribute('href', '/account/delete');
    // The CTA sub-element is marked so analytics / tests can target it.
    expect(screen.getByTestId('card-delete-cta')).toHaveTextContent(
      'Delete account',
    );
  });
});

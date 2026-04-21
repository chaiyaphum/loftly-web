import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../messages/th.json';

// NOTE on not-found.tsx: it's an **async server component** (uses
// `getTranslations`). Rather than fight the next-intl server runtime inside
// vitest/jsdom, we invoke it as a function, await the returned element tree,
// and render that. This covers the Thai H1 + 3 CTAs contract.
import NotFound from '@/app/not-found';
import RootError from '@/app/error';
import GlobalError from '@/app/global-error';

// Sentry is auto-imported by error.tsx / global-error.tsx. Stub it out so
// tests don't require a DSN or emit real events.
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// `getTranslations` is the server-side next-intl API; it can't run in the
// client-runtime vitest uses. Stub it to resolve keys against the Thai
// message file so our server component renders the expected Thai strings.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const segments = namespace.split('.');
    let scope: unknown = thMessages;
    for (const seg of segments) {
      scope = (scope as Record<string, unknown>)[seg];
    }
    return (key: string, values?: Record<string, string | number>) => {
      const parts = key.split('.');
      let node: unknown = scope;
      for (const p of parts) {
        node = (node as Record<string, unknown>)[p];
      }
      let out = String(node ?? key);
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          out = out.replaceAll(`{${k}}`, String(v));
        }
      }
      return out;
    };
  },
}));

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('not-found.tsx', () => {
  it('renders Thai H1 and 3 CTA links (home, cards, selector)', async () => {
    const tree = await NotFound();
    render(tree);

    expect(
      screen.getByRole('heading', { level: 1, name: 'ไม่พบหน้านี้' }),
    ).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: 'กลับหน้าหลัก' });
    const cardsLink = screen.getByRole('link', { name: 'ดูรีวิวบัตร' });
    const selectorLink = screen.getByRole('link', { name: 'ค้นหาบัตรที่ใช่' });

    expect(homeLink).toHaveAttribute('href', '/');
    expect(cardsLink).toHaveAttribute('href', '/cards');
    expect(selectorLink).toHaveAttribute('href', '/selector');
  });
});

describe('error.tsx', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the error code when `error.digest` is present', () => {
    const reset = vi.fn();
    const error = Object.assign(new Error('boom'), { digest: 'abc123xyz' });

    render(wrap(<RootError error={error} reset={reset} />));

    expect(
      screen.getByRole('heading', { level: 1, name: 'มีอะไรผิดพลาด' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('error-digest').textContent).toContain(
      'abc123xyz',
    );
  });

  it('omits the error-code line when `digest` is absent', () => {
    render(wrap(<RootError error={new Error('boom')} reset={vi.fn()} />));
    expect(screen.queryByTestId('error-digest')).toBeNull();
  });

  it('calls the `reset` prop when the retry button is clicked', () => {
    const reset = vi.fn();
    render(wrap(<RootError error={new Error('boom')} reset={reset} />));

    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    act(() => {
      fireEvent.click(retryBtn);
    });

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('global-error.tsx', () => {
  it('renders without crashing (ships its own <html>/<body>) and shows Thai H1', () => {
    // global-error renders an <html> element. React warns about nesting
    // <html> inside jsdom's existing document but still mounts the tree.
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<GlobalError error={new Error('root boom')} reset={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'มีอะไรผิดพลาด' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ลองใหม่' })).toBeInTheDocument();

    warn.mockRestore();
  });

  it('shows the digest code when provided', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('boom'), { digest: 'global-xyz' });
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(screen.getByTestId('error-digest').textContent).toContain(
      'global-xyz',
    );
    warn.mockRestore();
  });
});

/**
 * Error-path + polish tests for `/selector/results/[session_id]` (W7).
 *
 * We test the server component's ERROR branch (404 / 410 / 500) and the
 * client components in isolation (share button). The happy-path render is
 * covered by the existing Playwright suite (`tests/e2e/selector.spec.ts`);
 * unit tests here keep scope tight to the W7 polish deliverable.
 *
 * Note: we render the server component by calling it as an async function
 * and passing the returned JSX to `render`. That's the same pattern used in
 * `src/app/account/page.test.tsx`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../../../messages/th.json';
import { LoftlyAPIError } from '@/lib/api/client';

const mockGetSelectorResult = vi.fn();
const mockGetCard = vi.fn();
const mockCookies = vi.fn(async () => ({
  get: () => undefined,
}));
const mockRouterRefresh = vi.fn();

vi.mock('@/lib/api/selector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/selector')>();
  return {
    ...actual,
    getSelectorResult: (...args: unknown[]) => mockGetSelectorResult(...args),
  };
});

vi.mock('@/lib/api/cards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/cards')>();
  return {
    ...actual,
    getCard: (...args: unknown[]) => mockGetCard(...args),
  };
});

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (scope: string) => makeT(scope),
  getLocale: async () => 'th',
}));

function makeT(scope: string) {
  const dict = thMessages as unknown as Record<string, unknown>;
  const segments = scope.split('.');
  let node: unknown = dict;
  for (const seg of segments) {
    node = (node as Record<string, unknown>)?.[seg];
  }
  const t = (key: string, values?: Record<string, unknown>) => {
    const parts = key.split('.');
    let value: unknown = node;
    for (const p of parts) {
      value = (value as Record<string, unknown>)?.[p];
    }
    if (typeof value !== 'string') return key;
    if (values) {
      return Object.entries(values).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        value,
      );
    }
    return value;
  };
  return t;
}

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

async function renderPage(sessionId = 'sess-1', token?: string) {
  const { default: SelectorResultsPage } = await import('./page');
  const ui = await SelectorResultsPage({
    params: Promise.resolve({ session_id: sessionId }),
    searchParams: Promise.resolve(token ? { token } : {}),
  });
  return render(wrap(ui));
}

describe('SelectorResultsPage — error paths', () => {
  beforeEach(() => {
    mockGetSelectorResult.mockReset();
    mockGetCard.mockReset();
    mockRouterRefresh.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the 404 "not found" branch + new-search CTA', async () => {
    mockGetSelectorResult.mockRejectedValue(
      new LoftlyAPIError({
        code: 'selector_session_not_found',
        message_en: 'Not found',
        message_th: 'ไม่พบ session',
        status: 404,
      }),
    );

    await renderPage('missing');

    const wrapper = screen.getByTestId('selector-results-error');
    expect(wrapper).toHaveAttribute('data-kind', 'notFound');
    expect(wrapper).toHaveTextContent('ไม่พบผลการค้นหา');
    const cta = screen.getByTestId('selector-error-cta-notfound');
    expect(cta).toHaveAttribute('href', '/selector');
    // No retry CTA on 404.
    expect(screen.queryByTestId('selector-error-cta-retry')).toBeNull();
  });

  it('renders the 410 "expired" branch + re-run CTA', async () => {
    mockGetSelectorResult.mockRejectedValue(
      new LoftlyAPIError({
        code: 'selector_session_expired',
        message_en: 'Expired',
        message_th: 'หมดอายุ',
        status: 410,
      }),
    );

    await renderPage('expired-sess');

    const wrapper = screen.getByTestId('selector-results-error');
    expect(wrapper).toHaveAttribute('data-kind', 'expired');
    expect(wrapper).toHaveTextContent('ผลลัพธ์หมดอายุแล้ว');
    const cta = screen.getByTestId('selector-error-cta-expired');
    expect(cta).toHaveAttribute('href', '/selector');
  });

  it('renders a 500 generic error + retry button that calls router.refresh()', async () => {
    mockGetSelectorResult.mockRejectedValue(
      new LoftlyAPIError({
        code: 'internal_error',
        message_en: 'Boom',
        status: 500,
      }),
    );

    await renderPage('sess-500');

    const wrapper = screen.getByTestId('selector-results-error');
    expect(wrapper).toHaveAttribute('data-kind', 'generic');
    expect(wrapper).toHaveTextContent('เกิดข้อผิดพลาด');

    const retry = screen.getByTestId('selector-error-cta-retry');
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
    });
  });
});

describe('SelectorResultsPage — share button copies URL', () => {
  // Minimal SelectorResult that exercises the header render path.
  const result = {
    session_id: 'sess-share-1',
    stack: [],
    total_monthly_earning_points: 0,
    total_monthly_earning_thb_equivalent: 0,
    valuation_confidence: 0.8,
    rationale_th: '',
    warnings: [],
    llm_model: 'typhoon',
    fallback: false,
  };

  beforeEach(() => {
    mockGetSelectorResult.mockReset();
    mockGetCard.mockReset();
    mockGetSelectorResult.mockResolvedValue(result);
  });

  it('copies the session-only URL to the clipboard and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // jsdom provides `navigator` but not `clipboard` — install a stub.
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    // Pin the origin so the asserted URL is stable.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://loftly.co.th' },
    });

    await renderPage('sess-share-1');

    const button = screen.getByTestId('share-copy-button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    // Share URL includes ONLY the session_id — no `token`, no selector
    // query. This is the privacy contract documented in ShareButton.tsx.
    expect(writeText).toHaveBeenCalledWith(
      'https://loftly.co.th/selector/results/sess-share-1',
    );

    const toast = await screen.findByTestId('share-toast');
    expect(toast).toHaveAttribute('data-state', 'copied');
    expect(toast).toHaveTextContent('คัดลอกลิงก์แล้ว');
  });
});

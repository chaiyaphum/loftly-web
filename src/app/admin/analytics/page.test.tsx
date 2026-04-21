import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoftlyAPIError } from '@/lib/api/client';
import type { MetricsExport } from '@/lib/api/admin';

/**
 * Page test for `/admin/analytics` — the W23 seed-round dashboard.
 *
 * The page is a Next.js async server component. We mock:
 *   - `@/lib/auth/session` (no cookies in jsdom)
 *   - `@/lib/api/admin#exportMetrics` (no backend in unit tests)
 *   - `next/navigation#redirect` so the unauthenticated path doesn't throw
 *
 * We then `await` the component to get a React tree and render it with the
 * standard testing-library helpers. Three scenarios are covered:
 *   - happy path renders all six panels
 *   - backend 500 renders the inline error banner and skips the grid
 *   - unauthenticated admin triggers the redirect helper
 */

const mockExportMetrics = vi.fn();
const mockGetAdminSession = vi.fn();
const mockRedirect = vi.fn((...args: unknown[]): never => {
  // `redirect` throws in Next.js to unwind the RSC render — we mirror that
  // behaviour so the page test can assert the unauth path without real nav.
  void args;
  throw new Error('REDIRECTED');
});

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>();
  return {
    ...actual,
    exportMetrics: (...args: unknown[]) => mockExportMetrics(...args),
  };
});

vi.mock('@/lib/auth/session', () => ({
  getAdminSession: () => mockGetAdminSession(),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import AdminAnalyticsPage from './page';

function sampleMetrics(): MetricsExport {
  return {
    as_of: '2026-04-21',
    users: {
      total_registered: 12500,
      wau: 3200,
      mau: 8100,
      retention_12w: [0.8, 0.72, 0.65, 0.6, 0.55, 0.52, 0.5, 0.48, 0.46, 0.45, 0.44, 0.43],
      consent_grant_pct: 0.84,
      total_registered_delta_pct: 12.3,
      wau_delta_pct: 5.1,
      mau_delta_pct: 8.9,
    },
    selector: {
      invocations: 45000,
      unique_users: 3100,
      avg_latency_ms: 820,
      top1_conversion_rate: 0.18,
      eval_recall: 0.91,
      invocations_delta_pct: 22.5,
      avg_latency_delta_pct: -3.2,
    },
    affiliate: {
      total_commission_thb: 140000,
      commission_by_month: [
        { month: '2025-11', pending_thb: 5000, confirmed_thb: 10000, paid_thb: 8000 },
        { month: '2025-12', pending_thb: 6000, confirmed_thb: 12000, paid_thb: 9000 },
        { month: '2026-01', pending_thb: 7000, confirmed_thb: 14000, paid_thb: 10000 },
        { month: '2026-02', pending_thb: 8000, confirmed_thb: 16000, paid_thb: 11000 },
        { month: '2026-03', pending_thb: 9000, confirmed_thb: 18000, paid_thb: 12000 },
        { month: '2026-04', pending_thb: 10000, confirmed_thb: 20000, paid_thb: 13000 },
      ],
      top_cards: [
        { card_slug: 'kbank-world-plus', clicks: 1200, conversions: 120, commission_thb: 60000 },
        { card_slug: 'scb-m', clicks: 900, conversions: 80, commission_thb: 30000 },
        { card_slug: 'ktc-forbes', clicks: 700, conversions: 50, commission_thb: 20000 },
        { card_slug: 'uob-prvi', clicks: 500, conversions: 30, commission_thb: 15000 },
        { card_slug: 'citi-prestige', clicks: 300, conversions: 20, commission_thb: 15000 },
      ],
      total_commission_delta_pct: 18.0,
    },
    content: {
      articles_published: 48,
      avg_article_age_days: 32,
      schema_validation_rate: 0.97,
      articles_published_delta_pct: 4.2,
    },
    llm_costs: {
      anthropic_spend_thb: 8500,
      spend_per_mau_thb: 1.05,
      prompt_cache_hit_rate: 0.62,
      haiku_fallback_rate: 0.14,
      anthropic_spend_delta_pct: -7.5,
    },
    system: {
      uptime_pct: 0.9995,
      error_rate_5xx: 0.0012,
      p95_latency_ms: 410,
      uptime_delta_pct: 0.02,
      p95_latency_delta_pct: -2.0,
    },
  };
}

describe('AdminAnalyticsPage', () => {
  beforeEach(() => {
    mockExportMetrics.mockReset();
    mockGetAdminSession.mockReset();
    mockRedirect.mockClear();
    mockGetAdminSession.mockResolvedValue({
      accessToken: 'tok-admin',
      role: 'admin',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all six panels with the hero values from the metrics export', async () => {
    mockExportMetrics.mockResolvedValue(sampleMetrics());

    const ui = await AdminAnalyticsPage();
    render(ui);

    // Grid visible, no error banner.
    expect(screen.getByTestId('admin-analytics-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-analytics-error')).not.toBeInTheDocument();

    // All six panels rendered.
    for (const id of [
      'panel-users',
      'panel-selector',
      'panel-affiliate',
      'panel-content',
      'panel-llm',
      'panel-system',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }

    // Spot-check hero values.
    expect(screen.getByTestId('panel-users-value')).toHaveTextContent('12,500');
    expect(screen.getByTestId('panel-affiliate-value')).toHaveTextContent(
      'THB 140,000',
    );
    expect(screen.getByTestId('panel-llm-value')).toHaveTextContent('THB 8,500');
    // Uptime formatted to 2 dp.
    expect(screen.getByTestId('panel-system-value')).toHaveTextContent('99.95%');

    // Charts + top-card table wired through.
    expect(screen.getByTestId('panel-users-sparkline')).toBeInTheDocument();
    expect(screen.getByTestId('panel-affiliate-chart')).toBeInTheDocument();
    expect(screen.getByTestId('panel-affiliate-topcards')).toBeInTheDocument();
  });

  it('renders the inline error banner and skips the grid on a 500 response', async () => {
    mockExportMetrics.mockRejectedValue(
      new LoftlyAPIError({
        code: 'internal_error',
        message_en: 'Metrics exporter failed — try again in 60s.',
        status: 500,
      }),
    );

    const ui = await AdminAnalyticsPage();
    render(ui);

    expect(screen.getByTestId('admin-analytics-error')).toHaveTextContent(
      'Metrics exporter failed — try again in 60s.',
    );
    expect(screen.queryByTestId('admin-analytics-grid')).not.toBeInTheDocument();
  });

  it('redirects to onboarding when no admin session is present', async () => {
    mockGetAdminSession.mockResolvedValue(null);

    await expect(AdminAnalyticsPage()).rejects.toThrow('REDIRECTED');
    expect(mockRedirect).toHaveBeenCalledWith(
      '/onboarding?next=/admin/analytics',
    );
    // No metrics call should have been made.
    expect(mockExportMetrics).not.toHaveBeenCalled();
  });

  it('calls the metrics exporter with today’s ISO date and the admin token', async () => {
    mockExportMetrics.mockResolvedValue(sampleMetrics());

    const ui = await AdminAnalyticsPage();
    render(ui);

    const [token, opts] = mockExportMetrics.mock.calls[0] as [
      string,
      { asOf: string },
    ];
    expect(token).toBe('tok-admin');
    // Simple ISO shape check — the exact date is non-deterministic in CI.
    expect(opts.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

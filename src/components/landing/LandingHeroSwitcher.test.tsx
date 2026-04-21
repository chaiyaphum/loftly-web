import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../messages/th.json';

/**
 * LandingHeroSwitcher — POST_V1 §3 returning-user hero variant router.
 *
 * The switcher itself is a client component, but its SSR behaviour is part
 * of the crawler contract (must emit only `defaultHero`), so we test both
 * hydration paths AND a `renderToStaticMarkup` safety check.
 *
 * Mock strategy:
 *   - `@/lib/posthog`     → deterministic `getFeatureFlag` values.
 *   - `@/lib/analytics`   → capture `useTrackEvent` invocations.
 *   - `@/lib/api/selector`→ stub `getRecentSelectorSession` and `archiveSelectorSession`.
 *   - `@/lib/selector-session-cookie` → stub `readSelectorSessionCookie`.
 *   - `next/navigation`   → stub `useRouter().push` so we can assert redirect.
 */

const mockGetFeatureFlag =
  vi.fn<(key: string) => string | boolean | undefined>();
const mockOnFeatureFlags = vi.fn<(cb: () => void) => () => void>();

vi.mock('@/lib/posthog', () => ({
  loadPostHog: vi.fn().mockImplementation(async () => ({
    getFeatureFlag: mockGetFeatureFlag,
    onFeatureFlags: mockOnFeatureFlags,
  })),
  getPostHog: vi.fn().mockImplementation(() => ({
    getFeatureFlag: mockGetFeatureFlag,
    onFeatureFlags: mockOnFeatureFlags,
  })),
}));

const mockTrack = vi.fn();
vi.mock('@/lib/analytics', () => ({
  useTrackEvent: () => mockTrack,
}));

const mockReadCookie = vi.fn();
vi.mock('@/lib/selector-session-cookie', () => ({
  readSelectorSessionCookie: () => mockReadCookie(),
}));

const mockGetRecent = vi.fn();
const mockArchive = vi.fn();
vi.mock('@/lib/api/selector', () => ({
  getRecentSelectorSession: (sid: string) => mockGetRecent(sid),
  archiveSelectorSession: (sid: string) => mockArchive(sid),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { LandingHeroSwitcher } from './LandingHeroSwitcher';

function DefaultHero() {
  return <h1>ยกระดับทุกแต้มบัตรเครดิตของคุณ</h1>;
}

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('LandingHeroSwitcher', () => {
  beforeEach(() => {
    mockGetFeatureFlag.mockReset();
    mockOnFeatureFlags.mockReset();
    mockOnFeatureFlags.mockImplementation(() => () => {});
    mockTrack.mockReset();
    mockReadCookie.mockReset();
    mockGetRecent.mockReset();
    mockArchive.mockReset();
    mockPush.mockReset();
  });

  it('renders default hero when no recognition cookie is present', async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue(null);

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /ยกระดับทุกแต้ม/ }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/ยินดีต้อนรับกลับ/),
    ).not.toBeInTheDocument();
    expect(mockGetRecent).not.toHaveBeenCalled();
    // Even the `none` outcome should fire the shown-event (denominator).
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_returning_user_shown', {
        variant: 'none',
        hours_since_last_session: null,
      }),
    );
  });

  it('renders default hero when the feature flag is OFF (cookie ignored)', async () => {
    mockGetFeatureFlag.mockReturnValue(false);
    mockReadCookie.mockReturnValue({
      session_id: 'sess-1',
      last_seen_at: new Date().toISOString(),
    });

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /ยกระดับทุกแต้ม/ }),
      ).toBeInTheDocument();
    });
    // Flag OFF means we never even ask the backend.
    expect(mockGetRecent).not.toHaveBeenCalled();
  });

  it('renders default hero + expired banner when Redis says expired', async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'sess-exp',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockResolvedValue({
      card_name: null,
      card_id: null,
      hours_since_last_session: 72,
      expired: true,
    });

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    await waitFor(() => {
      expect(
        screen.getByTestId('returning-hero-expired'),
      ).toBeInTheDocument();
    });
    // Default hero remains for the expired path (banner sits below).
    expect(
      screen.getByRole('heading', { name: /ยกระดับทุกแต้ม/ }),
    ).toBeInTheDocument();
    // No card data in the expired banner — only the generic prompt.
    expect(
      screen.getByText('คุณเคยใช้ Selector — ทำใหม่ไหม?'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_returning_user_shown', {
        variant: 'expired',
        hours_since_last_session: 72,
      }),
    );
  });

  it('renders personalized variant (new H1 + 2 CTAs) when Redis has a valid session', async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'sess-ok',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockResolvedValue({
      card_name: 'KBank The One',
      card_id: 'kbank-the-one',
      hours_since_last_session: 4,
      expired: false,
    });

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    await waitFor(() => {
      expect(
        screen.getByTestId('returning-hero-personalized'),
      ).toBeInTheDocument();
    });
    // New H1 replaces the SSR hero (they're mutually exclusive in this branch).
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'ยินดีต้อนรับกลับ — บัตร KBank The One สำหรับคุณ',
    );
    expect(
      screen.queryByText('ยกระดับทุกแต้มบัตรเครดิตของคุณ'),
    ).not.toBeInTheDocument();
    // 2 CTAs.
    expect(
      screen.getByRole('link', { name: /ดูผลเต็ม/ }),
    ).toHaveAttribute('href', '/selector/results/sess-ok');
    expect(
      screen.getByRole('button', { name: /ทำ Selector ใหม่/ }),
    ).toBeInTheDocument();
  });

  it("fires 'landing_returning_user_shown' at most once per resolved variant", async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'sess-x',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockResolvedValue({
      card_name: 'SCB M',
      card_id: 'scb-m',
      hours_since_last_session: 2,
      expired: false,
    });

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_returning_user_shown', {
        variant: 'personalized',
        hours_since_last_session: 2,
      }),
    );
    // The 'personalized' bucket must never fire twice in the same mount —
    // that would double-count conversion denominators in PostHog.
    const personalizedShown = mockTrack.mock.calls.filter(
      (c) =>
        c[0] === 'landing_returning_user_shown' &&
        (c[1] as { variant: string }).variant === 'personalized',
    );
    expect(personalizedShown).toHaveLength(1);
  });

  it("'ดูผลเต็ม' link points to /selector/results/{session_id} and emits the CTA event", async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'abc-123',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockResolvedValue({
      card_name: 'KTC Forever',
      card_id: 'ktc-forever',
      hours_since_last_session: 1,
      expired: false,
    });

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    const cta = await screen.findByRole('link', { name: /ดูผลเต็ม/ });
    expect(cta).toHaveAttribute('href', '/selector/results/abc-123');
    fireEvent.click(cta);
    expect(mockTrack).toHaveBeenCalledWith('landing_returning_cta_clicked', {
      cta: 'view_results',
      variant: 'personalized',
    });
  });

  it("'ทำ Selector ใหม่' opens confirm modal, archives on confirm, then routes to /selector", async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'restart-1',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockResolvedValue({
      card_name: 'KBank The One',
      card_id: 'kbank-the-one',
      hours_since_last_session: 1,
      expired: false,
    });
    mockArchive.mockResolvedValue(undefined);

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    const restartBtn = await screen.findByRole('button', {
      name: /ทำ Selector ใหม่/,
    });
    fireEvent.click(restartBtn);

    // Confirm modal opens.
    expect(screen.getByTestId('restart-confirm')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: /^เริ่มใหม่$/ });

    await act(async () => {
      fireEvent.click(confirmBtn);
      // Let the archive promise + router.push microtasks flush.
      await Promise.resolve();
    });

    expect(mockTrack).toHaveBeenCalledWith('landing_returning_cta_clicked', {
      cta: 'restart_selector',
      variant: 'personalized',
    });
    expect(mockArchive).toHaveBeenCalledWith('restart-1');
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/selector'));
  });

  it('SSR (renderToStaticMarkup) contains only the defaultHero, not the personalized copy', () => {
    // During SSR there is no cookie + no PostHog + no effects — the switcher
    // must return `defaultHero` and nothing else. This is the crawler contract.
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'ssr-1',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockResolvedValue({
      card_name: 'KBank The One',
      card_id: 'kbank-the-one',
      hours_since_last_session: 1,
      expired: false,
    });

    const html = renderToStaticMarkup(
      wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />),
    );

    expect(html).toContain('ยกระดับทุกแต้มบัตรเครดิตของคุณ');
    expect(html).not.toContain('ยินดีต้อนรับกลับ');
    expect(html).not.toContain('คุณเคยใช้ Selector');
  });

  it('falls back to default hero silently when /selector/recent rejects', async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    mockReadCookie.mockReturnValue({
      session_id: 'sess-err',
      last_seen_at: new Date().toISOString(),
    });
    mockGetRecent.mockRejectedValue(new Error('network down'));

    render(wrap(<LandingHeroSwitcher defaultHero={<DefaultHero />} />));

    await waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith('landing_returning_user_shown', {
        variant: 'none',
        hours_since_last_session: null,
      }),
    );
    expect(
      screen.getByRole('heading', { name: /ยกระดับทุกแต้ม/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('returning-hero-personalized'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('returning-hero-expired'),
    ).not.toBeInTheDocument();
  });
});

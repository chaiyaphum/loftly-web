/**
 * ChatPanel tests (POST_V1 §1, Tier A).
 *
 * Covers the flag gate, suggested prompt UX, happy-path 200, what-if
 * rerank bullets, rate limiting (429), and the 403 email-gate fallback.
 * The panel is a client component, so we stub feature flags + analytics
 * and stand up a mock fetch for `/selector/{session_id}/chat`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../../../messages/th.json';

const mockUseFeatureFlag = vi.fn();
const trackSpy = vi.fn();

vi.mock('@/lib/feature-flags', () => ({
  useFeatureFlag: (key: string, defaultValue: unknown) =>
    mockUseFeatureFlag(key, defaultValue),
}));

vi.mock('@/lib/analytics', () => ({
  useTrackEvent: () => trackSpy,
}));

// Mock MagicLinkPrompt — the real one hits `requestMagicLink`, which we
// don't need to exercise here. We just assert the panel renders it.
vi.mock('@/components/loftly/MagicLinkPrompt', () => ({
  MagicLinkPrompt: (props: { sessionId?: string | null }) => (
    <div data-testid="magic-link-prompt" data-session-id={props.sessionId} />
  ),
}));

import { ChatPanel } from './ChatPanel';

const originalFetch = globalThis.fetch;
const SESSION_ID = 'sess-abcdef';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function wrap(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="th" messages={thMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof ChatPanel>> = {},
) {
  return render(
    wrap(
      <ChatPanel
        sessionId={SESSION_ID}
        accessToken={null}
        authState="anon"
        {...props}
      />,
    ),
  );
}

describe('ChatPanel', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
    mockUseFeatureFlag.mockReset();
    trackSpy.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders null when the post_v1_selector_chat flag is OFF', () => {
    mockUseFeatureFlag.mockImplementation(
      (_key: string, defaultValue: unknown) => defaultValue,
    );

    const { container } = renderPanel();
    expect(container.firstChild).toBeNull();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('renders the 3 suggested prompts + textarea when the flag is ON and fires selector_chat_opened once', () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    renderPanel();

    expect(
      screen.getByRole('button', { name: /ทำไมอันดับ 1/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /เปรียบเทียบกับบัตรอื่น/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ถ้า spend เปลี่ยน/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/),
    ).toBeInTheDocument();

    expect(trackSpy).toHaveBeenCalledWith('selector_chat_opened', {
      session_id: SESSION_ID,
      auth_state: 'anon',
    });
    // Guard against double-fire on re-render.
    expect(trackSpy).toHaveBeenCalledTimes(1);
  });

  it('fills the textarea with a suggested prompt when clicked', () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /ทำไมอันดับ 1/ }));
    const textarea = screen.getByPlaceholderText(
      /พิมพ์คำถามของคุณ/,
    ) as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/ทำไมอันดับ 1/);
  });

  it('submits the question to POST /selector/{id}/chat and renders the answer on 200', async () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        answer_th: 'บัตรนี้อันดับ 1 เพราะคุณใช้จ่าย online เยอะ',
        answer_en: 'Because online spend dominates',
        category: 'explain',
        cards_changed: false,
        new_stack: null,
        rationale_diff_bullets: [],
        remaining_questions: 9,
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/), {
      target: { value: 'ทำไมบัตรอันดับ 1?' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ส่งคำถาม/ }));
    });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://example.test/v1/selector/${SESSION_ID}/chat`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      question: 'ทำไมบัตรอันดับ 1?',
    });

    await waitFor(() =>
      expect(
        screen.getByText(/บัตรนี้อันดับ 1 เพราะคุณใช้จ่าย online เยอะ/),
      ).toBeInTheDocument(),
    );
    // Remaining count surfaces after the first answer.
    expect(screen.getByText(/9 คำถามคงเหลือ/)).toBeInTheDocument();
  });

  it('renders rationale diff bullets and the new-stack disclosure for a what-if with cards_changed', async () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        answer_th: 'ถ้า dining เพิ่ม 20,000 บาท บัตร X ขยับขึ้นมาอันดับ 1',
        answer_en: 'If dining adds 20k THB, card X moves to #1',
        category: 'what-if',
        cards_changed: true,
        new_stack: [
          {
            card_id: 'c-x',
            slug: 'kbank-dining',
            role: 'primary',
            monthly_earning_points: 7200,
            monthly_earning_thb_equivalent: 10800,
            annual_fee_thb: 4000,
            reason_th: 'dining x3',
          },
          {
            card_id: 'c-y',
            slug: 'scb-online',
            role: 'secondary',
            monthly_earning_points: 4500,
            monthly_earning_thb_equivalent: 6750,
            annual_fee_thb: 0,
            reason_th: 'online 2x',
          },
        ],
        rationale_diff_bullets: [
          'dining +20,000 THB ดันบัตร X ขึ้นอันดับ 1',
          'บัตรเดิมอันดับ 1 ขยับไปอันดับ 2',
        ],
        remaining_questions: 7,
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/), {
      target: { value: 'ถ้า dining เพิ่ม 20,000 บาท ผลเปลี่ยนไหม?' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ส่งคำถาม/ }));
    });

    await waitFor(() =>
      expect(
        screen.getByText(/dining \+20,000 THB ดันบัตร X ขึ้นอันดับ 1/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/บัตรเดิมอันดับ 1 ขยับไปอันดับ 2/),
    ).toBeInTheDocument();
    // Disclosure summary for the new stack.
    expect(screen.getByText(/ดูลำดับใหม่/)).toBeInTheDocument();
    // Toggle open to reveal the ordered list.
    fireEvent.click(screen.getByText(/ดูลำดับใหม่/));
    await waitFor(() =>
      expect(screen.getByText(/kbank-dining/)).toBeInTheDocument(),
    );
  });

  it('disables input and shows the rate-limit banner when the server returns 429', async () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(429, {
        error: {
          code: 'selector_chat_rate_limited',
          message_en: 'Rate limited',
          message_th: 'คำถามต่อเซสชันครบแล้ว',
        },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/), {
      target: { value: 'ถามเยอะไปมั้ย' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ส่งคำถาม/ }));
    });

    await waitFor(() =>
      expect(
        screen.getByText(/คำถามต่อเซสชันครบแล้ว/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('link', { name: /ทำ Selector ใหม่/ }),
    ).toHaveAttribute('href', '/selector');
    // Textarea is disabled.
    expect(
      screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/),
    ).toBeDisabled();
  });

  it('switches into the email-gate mode with MagicLinkPrompt on a 403 response', async () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        error: {
          code: 'selector_chat_email_required',
          message_en: 'Email required',
          message_th: 'กรุณากรอกอีเมล',
        },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/), {
      target: { value: 'ถามเพิ่มหน่อย' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ส่งคำถาม/ }));
    });

    await waitFor(() =>
      expect(screen.getByTestId('magic-link-prompt')).toHaveAttribute(
        'data-session-id',
        SESSION_ID,
      ),
    );
    expect(
      screen.getByText(/ใส่อีเมลเพื่อถามคำถามเพิ่มเติม/),
    ).toBeInTheDocument();
    // Textarea should no longer be in the DOM (replaced by the gate UI).
    expect(
      screen.queryByPlaceholderText(/พิมพ์คำถามของคุณ/),
    ).not.toBeInTheDocument();
  });

  it('shows the expired banner on 410 responses', async () => {
    mockUseFeatureFlag.mockImplementation((key: string) =>
      key === 'post_v1_selector_chat' ? true : false,
    );

    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(410, {
        error: {
          code: 'selector_session_expired',
          message_en: 'Session expired',
          message_th: 'เซสชันหมดอายุ',
        },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    renderPanel();

    fireEvent.change(screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/), {
      target: { value: 'ยังถามได้มั้ย' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /ส่งคำถาม/ }));
    });

    await waitFor(() =>
      expect(
        screen.getByText(/ผลลัพธ์หมดอายุแล้ว ทำ Selector ใหม่/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByPlaceholderText(/พิมพ์คำถามของคุณ/),
    ).toBeDisabled();
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  listeners: Record<string, Array<(ev: MessageEvent | Event) => void>> = {};
  closed = false;
  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = Boolean(init?.withCredentials);
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (ev: MessageEvent | Event) => void) {
    this.listeners[type] ??= [];
    this.listeners[type].push(handler);
  }
  dispatch(type: string, data?: string) {
    const ev =
      data !== undefined
        ? (new MessageEvent(type, { data }) as MessageEvent)
        : (new Event(type) as Event);
    for (const l of this.listeners[type] ?? []) l(ev);
  }
  close() {
    this.closed = true;
  }
}

describe('openSelectorStream', () => {
  beforeEach(() => {
    MockEventSource.instances.length = 0;
    (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource =
      MockEventSource as unknown as typeof MockEventSource;
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses envelope, rationale, and done events in order', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');
    const envelope = {
      session_id: 's-1',
      stack: [],
      total_monthly_earning_points: 0,
      total_monthly_earning_thb_equivalent: 0,
      valuation_confidence: 0.8,
      rationale_th: '',
      warnings: [],
      llm_model: 'test',
      fallback: false,
    };

    const onEnvelope = vi.fn();
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const ctrl = openSelectorStream('s-1', 'tok', {
      onEnvelope,
      onRationaleChunk: onChunk,
      onDone,
    });

    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();
    expect(es!.url).toContain('stream=true');
    expect(es!.url).toContain('token=tok');

    es!.dispatch('envelope', JSON.stringify(envelope));
    es!.dispatch('rationale', JSON.stringify({ delta: 'Hello ' }));
    es!.dispatch('rationale', JSON.stringify({ delta: 'world' }));
    es!.dispatch('done');

    expect(onEnvelope).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(es!.closed).toBe(true);
    ctrl.close();
  });

  it('falls back to fetch on immediate error before envelope', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: 's-2',
          stack: [],
          total_monthly_earning_points: 0,
          total_monthly_earning_thb_equivalent: 0,
          valuation_confidence: 0.8,
          rationale_th: 'from fallback',
          warnings: [],
          llm_model: 'test',
          fallback: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchSpy;

    const onError = vi.fn();
    const onEnvelope = vi.fn();
    openSelectorStream('s-2', null, { onEnvelope, onError });
    const es = MockEventSource.instances[0];
    es!.dispatch('error');

    // Fallback fetch is async; flush microtasks.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSpy).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});

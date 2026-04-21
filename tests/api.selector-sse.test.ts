import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Mock EventSource with configurable `readyState` so we can simulate:
 *   - CONNECTING (0): transient network blip → client should retry
 *   - OPEN (1)      : normal
 *   - CLOSED (2)    : terminal (auth/404) → client should NOT retry
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSED = 2 as const;

  url: string;
  withCredentials: boolean;
  listeners: Record<string, Array<(ev: MessageEvent | Event) => void>> = {};
  readyState: 0 | 1 | 2 = 1; // default OPEN
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
    this.readyState = 2;
  }
}

function installMockEventSource() {
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource =
    MockEventSource as unknown as typeof MockEventSource;
}

const sampleEnvelope = {
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

describe('openSelectorStream', () => {
  beforeEach(() => {
    MockEventSource.instances.length = 0;
    installMockEventSource();
    process.env.NEXT_PUBLIC_API_BASE = 'http://example.test/v1';
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('parses envelope, rationale, and done events in order (happy path)', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

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

    es!.dispatch('envelope', JSON.stringify(sampleEnvelope));
    es!.dispatch('rationale', JSON.stringify({ delta: 'Hello ' }));
    es!.dispatch('rationale', JSON.stringify({ delta: 'world' }));
    es!.dispatch('done');

    expect(onEnvelope).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(es!.closed).toBe(true);
    ctrl.close();
  });

  it('reconnects after 1 transient error and completes', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onReconnect = vi.fn();
    const onReconnectGiveUp = vi.fn();

    openSelectorStream('s-1', null, {
      onRationaleChunk: onChunk,
      onDone,
      onReconnect,
      onReconnectGiveUp,
      // Use faster backoff to keep tests snappy.
      backoffMs: () => 10,
    });

    const es1 = MockEventSource.instances[0]!;
    es1.dispatch('envelope', JSON.stringify(sampleEnvelope));
    es1.dispatch('rationale', JSON.stringify({ delta: 'part1 ' }));

    // Transient error — still connecting (browser would auto-reconnect,
    // we take over).
    es1.readyState = 0; // CONNECTING
    es1.dispatch('error');

    expect(onReconnect).toHaveBeenCalledWith(1);

    await vi.advanceTimersByTimeAsync(10);

    const es2 = MockEventSource.instances[1]!;
    expect(es2).toBeDefined();
    // Resume token included on reconnect.
    expect(es2.url).toContain('resume_from=');

    es2.dispatch('rationale', JSON.stringify({ delta: 'part2' }));
    es2.dispatch('done');

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onReconnectGiveUp).not.toHaveBeenCalled();
    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 consecutive errors', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleEnvelope), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const onReconnect = vi.fn();
    const onReconnectGiveUp = vi.fn();

    openSelectorStream('s-1', null, {
      onReconnect,
      onReconnectGiveUp,
      backoffMs: () => 10,
      maxRetries: 3,
    });

    // Three transient errors in a row (no successful chunk in between).
    for (let i = 0; i < 3; i++) {
      const es = MockEventSource.instances[i]!;
      es.readyState = 0; // CONNECTING — transient
      es.dispatch('error');
      await vi.advanceTimersByTimeAsync(10);
    }

    // 4th EventSource has opened from the 3rd retry; now simulate it erroring too.
    const esFinal = MockEventSource.instances[3]!;
    esFinal.readyState = 0;
    esFinal.dispatch('error');

    expect(onReconnect).toHaveBeenCalledTimes(3);
    expect(onReconnectGiveUp).toHaveBeenCalledTimes(1);
  });

  it('does not retry on terminal (401/403) error — readyState CLOSED', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleEnvelope), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const onReconnect = vi.fn();
    const onReconnectGiveUp = vi.fn();
    const onError = vi.fn();
    const onEnvelope = vi.fn();

    openSelectorStream('s-1', null, {
      onReconnect,
      onReconnectGiveUp,
      onError,
      onEnvelope,
      backoffMs: () => 10,
    });

    const es = MockEventSource.instances[0]!;
    es.readyState = 2; // CLOSED — browser gave up (auth failure pattern)
    es.dispatch('error');

    // Flush microtasks (fallback fetch promise resolution).
    await vi.advanceTimersByTimeAsync(50);

    expect(onReconnect).not.toHaveBeenCalled();
    expect(onReconnectGiveUp).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    // Fallback fetch was triggered (no envelope received).
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(MockEventSource.instances).toHaveLength(1); // no reconnect
  });

  it('clean close after done: no further reconnect', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

    const onReconnect = vi.fn();
    const onReconnectGiveUp = vi.fn();
    const onDone = vi.fn();

    openSelectorStream('s-1', null, {
      onDone,
      onReconnect,
      onReconnectGiveUp,
      backoffMs: () => 10,
    });

    const es = MockEventSource.instances[0]!;
    es.dispatch('envelope', JSON.stringify(sampleEnvelope));
    es.dispatch('done');
    expect(onDone).toHaveBeenCalledTimes(1);

    // Stray error after done — must not spawn a reconnect.
    es.dispatch('error');
    await vi.advanceTimersByTimeAsync(100);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(onReconnect).not.toHaveBeenCalled();
    expect(onReconnectGiveUp).not.toHaveBeenCalled();
  });

  it('caller close() prevents any scheduled reconnect from firing', async () => {
    const { openSelectorStream } = await import('@/lib/api/selector-sse');

    const onReconnect = vi.fn();
    const ctrl = openSelectorStream('s-1', null, {
      onReconnect,
      backoffMs: () => 50,
    });

    const es = MockEventSource.instances[0]!;
    es.dispatch('envelope', JSON.stringify(sampleEnvelope));
    es.readyState = 0;
    es.dispatch('error'); // schedules reconnect in 50ms

    expect(onReconnect).toHaveBeenCalledWith(1);
    ctrl.close(); // cancel before timer fires

    await vi.advanceTimersByTimeAsync(100);
    expect(MockEventSource.instances).toHaveLength(1); // no new connection
  });

  it('falls back to fetch on immediate terminal error before envelope', async () => {
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
    const es = MockEventSource.instances[0]!;
    es.readyState = 2; // CLOSED — terminal
    es.dispatch('error');

    await vi.advanceTimersByTimeAsync(10);
    expect(fetchSpy).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
});

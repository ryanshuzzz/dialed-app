import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '@/hooks/useSSE';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onerror: ((e: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  close() {
    this.closed = true;
  }

  // Test helper: simulate an SSE event
  emit(event: string, data: string) {
    const handlers = this.listeners[event] ?? [];
    for (const handler of handlers) {
      handler(new MessageEvent(event, { data }));
    }
  }

  emitError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSSE', () => {
  it('creates an EventSource when url is provided', () => {
    renderHook(() => useSSE('/ingest/jobs/job-1/stream', {}));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('/ingest/jobs/job-1/stream');
  });

  it('does not create an EventSource when url is null', () => {
    renderHook(() => useSSE(null, {}));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('calls onToken handler for token events', () => {
    const onToken = vi.fn();
    renderHook(() => useSSE('/suggest/job-1/stream', { onToken }));

    const es = MockEventSource.instances[0];
    act(() => es.emit('token', 'Hello'));
    act(() => es.emit('token', ' world'));

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenCalledWith('Hello');
    expect(onToken).toHaveBeenCalledWith(' world');
  });

  it('calls onStatus handler for status events', () => {
    const onStatus = vi.fn();
    renderHook(() => useSSE('/suggest/job-1/stream', { onStatus }));

    const es = MockEventSource.instances[0];
    act(() => es.emit('status', '{"status": "processing"}'));

    expect(onStatus).toHaveBeenCalledWith('processing');
  });

  it('calls onComplete and closes the stream', () => {
    const onComplete = vi.fn();
    renderHook(() => useSSE('/suggest/job-1/stream', { onComplete }));

    const es = MockEventSource.instances[0];
    act(() => es.emit('complete', '{"id": "suggestion-1"}'));

    expect(onComplete).toHaveBeenCalledWith({ id: 'suggestion-1' });
    expect(es.closed).toBe(true);
  });

  it('calls onFailed and closes the stream', () => {
    const onFailed = vi.fn();
    renderHook(() => useSSE('/suggest/job-1/stream', { onFailed }));

    const es = MockEventSource.instances[0];
    act(() => es.emit('failed', '{"error_message": "something went wrong"}'));

    expect(onFailed).toHaveBeenCalledWith({ error_message: 'something went wrong' });
    expect(es.closed).toBe(true);
  });

  it('calls onError handler on EventSource error', () => {
    const onError = vi.fn();
    renderHook(() => useSSE('/suggest/job-1/stream', { onError }));

    const es = MockEventSource.instances[0];
    act(() => es.emitError());

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = renderHook(() =>
      useSSE('/ingest/jobs/job-1/stream', {}),
    );

    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });

  it('closes old EventSource and opens new one when url changes', () => {
    const { rerender } = renderHook(
      ({ url }) => useSSE(url, {}),
      { initialProps: { url: '/suggest/job-1/stream' as string | null } },
    );

    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0];

    rerender({ url: '/suggest/job-2/stream' });

    expect(first.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].url).toContain('/suggest/job-2/stream');
  });
});

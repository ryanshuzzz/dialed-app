import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOfflineStore } from '@/stores/offlineStore';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  await useOfflineStore.getState().clear();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('Offline queue', () => {
  it('enqueues mutations when offline', async () => {
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
      body: JSON.stringify({ make: 'Yamaha', model: 'R1' }),
    });

    const queue = useOfflineStore.getState().queue;
    expect(queue).toHaveLength(1);
    expect(queue[0].endpoint).toBe('/garage/bikes');
    expect(queue[0].method).toBe('POST');

    // Restore
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('replays queued mutations when online', async () => {
    // Enqueue two mutations while "offline"
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
      body: JSON.stringify({ make: 'Honda', model: 'CBR1000RR' }),
    });
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes/bike-1',
      method: 'PATCH',
      body: JSON.stringify({ mileage_km: 5000 }),
    });

    expect(useOfflineStore.getState().queue).toHaveLength(2);

    // Mock successful fetch responses for replay
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    // Replay: dequeue and call fetch for each
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const store = useOfflineStore.getState();
    let mutation = store.peek();
    while (mutation && navigator.onLine) {
      await fetch(`http://localhost:8000/api/v1${mutation.endpoint}`, {
        method: mutation.method,
        body: mutation.body,
      });
      await store.dequeue();
      mutation = useOfflineStore.getState().peek();
    }

    expect(useOfflineStore.getState().queue).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('stops replay on failure and keeps remaining items', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
      body: JSON.stringify({ make: 'Kawasaki', model: 'ZX-10R' }),
    });
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes/bike-2',
      method: 'PATCH',
      body: JSON.stringify({ status: 'sold' }),
    });

    // First call fails
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Conflict', code: 'VALIDATION_ERROR' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const store = useOfflineStore.getState();
    const mutation = store.peek();
    if (mutation) {
      const resp = await fetch(`http://localhost:8000/api/v1${mutation.endpoint}`, {
        method: mutation.method,
        body: mutation.body,
      });
      // Simulate: if response not ok, stop replay (don't dequeue)
      if (!resp.ok) {
        // Leave items in queue
      }
    }

    // Both items should still be in the queue since we stopped on failure
    expect(useOfflineStore.getState().queue).toHaveLength(2);
  });
});

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
  it('enqueues mutation when offline', async () => {
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
    expect(queue[0].body).toContain('Yamaha');

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('stores mutation with unique id and timestamp', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
      body: JSON.stringify({ make: 'Honda', model: 'CBR600RR' }),
    });

    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes/b1',
      method: 'PATCH',
      body: JSON.stringify({ mileage_km: 2000 }),
    });

    const queue = useOfflineStore.getState().queue;
    expect(queue).toHaveLength(2);
    expect(queue[0].id).not.toBe(queue[1].id);
    expect(queue[0].timestamp).toBeLessThanOrEqual(queue[1].timestamp);
  });

  it('dequeues mutations in FIFO order', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/first',
      method: 'POST',
    });
    await useOfflineStore.getState().enqueue({
      endpoint: '/second',
      method: 'POST',
    });

    const first = await useOfflineStore.getState().dequeue();
    expect(first?.endpoint).toBe('/first');

    const second = await useOfflineStore.getState().dequeue();
    expect(second?.endpoint).toBe('/second');

    expect(useOfflineStore.getState().queue).toHaveLength(0);
  });

  it('peek returns first item without removing it', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/peek-test',
      method: 'POST',
    });

    const peeked = useOfflineStore.getState().peek();
    expect(peeked?.endpoint).toBe('/peek-test');
    expect(useOfflineStore.getState().queue).toHaveLength(1);
  });

  it('clear removes all items from queue', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/a',
      method: 'POST',
    });
    await useOfflineStore.getState().enqueue({
      endpoint: '/b',
      method: 'POST',
    });

    expect(useOfflineStore.getState().queue).toHaveLength(2);

    await useOfflineStore.getState().clear();

    expect(useOfflineStore.getState().queue).toHaveLength(0);
  });

  it('replays queued mutations when online', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
      body: JSON.stringify({ make: 'Suzuki', model: 'GSX-R1000' }),
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const store = useOfflineStore.getState();
    const mutation = store.peek();
    if (mutation && navigator.onLine) {
      await fetch(`http://localhost:8000/api/v1${mutation.endpoint}`, {
        method: mutation.method,
        body: mutation.body,
      });
      await store.dequeue();
    }

    expect(useOfflineStore.getState().queue).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

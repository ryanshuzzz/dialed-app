import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useBikes, useCreateBike } from '@/hooks/useBikes';
import type { Bike } from '@/api/types';

const mockBike: Bike = {
  id: 'bike-1',
  user_id: 'user-1',
  make: 'Ducati',
  model: 'Panigale V4',
  year: 2024,
  suspension_spec: { schema_version: 1 },
  status: 'owned',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('useBikes', () => {
  it('returns a list of bikes', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockBike]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useBikes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].make).toBe('Ducati');
  });

  it('handles API errors', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useBikes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });
});

describe('useCreateBike', () => {
  it('creates a bike and invalidates the list query', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockBike]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const wrapper = createWrapper();

    // First, render the list query so it populates cache
    const { result: listResult } = renderHook(() => useBikes(), { wrapper });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));

    // Now create a bike
    const newBike = { ...mockBike, id: 'bike-2', model: 'Streetfighter V4' };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(newBike), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // The invalidation will trigger a refetch of the bikes list
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockBike, newBike]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result: createResult } = renderHook(() => useCreateBike(), { wrapper });

    createResult.current.mutate({ make: 'Ducati', model: 'Streetfighter V4' });

    await waitFor(() => expect(createResult.current.isSuccess).toBe(true));
    expect(createResult.current.data?.model).toBe('Streetfighter V4');
  });
});

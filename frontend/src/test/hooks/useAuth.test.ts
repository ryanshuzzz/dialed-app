import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';

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
  useAuthStore.getState().logout();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('useLogin', () => {
  it('stores the token on successful login', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user_id: 'user-1',
          token: 'jwt-access-token',
          refresh_token: 'jwt-refresh-token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ email: 'rider@dialed.app', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const authState = useAuthStore.getState();
    expect(authState.token).toBe('jwt-access-token');
  });

  it('handles login failure', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'Invalid credentials', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ email: 'rider@dialed.app', password: 'wrong' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const authState = useAuthStore.getState();
    expect(authState.token).toBeNull();
  });
});

describe('logout', () => {
  it('clears the auth state', () => {
    const store = useAuthStore.getState();
    store.setToken('some-token');
    expect(useAuthStore.getState().token).toBe('some-token');

    store.logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '@/api/types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  login: (token: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
  setUser: (user: UserProfile) => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      login: (token, refreshToken, user) =>
        set({ token, refreshToken, user }),
      logout: () =>
        set({ token: null, refreshToken: null, user: null }),
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'dialed-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);

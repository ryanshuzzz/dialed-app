import { create } from 'zustand';
import type { UserProfile } from '@/api/types';

type RiderType = UserProfile['rider_type'];

interface UiState {
  sidebarOpen: boolean;
  riderType: RiderType;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setRiderType: (type: RiderType) => void;
  isNavVisible: (item: NavItem) => boolean;
}

export type NavItem =
  | 'garage'
  | 'sessions'
  | 'progress'
  | 'admin'
  | 'settings'
  | 'tracks'
  | 'events'
  | 'ai';

const NAV_VISIBILITY: Record<RiderType, Set<NavItem>> = {
  street: new Set(['garage', 'settings']),
  casual_track: new Set(['garage', 'sessions', 'tracks', 'events', 'progress', 'ai', 'settings']),
  competitive: new Set([
    'garage',
    'sessions',
    'tracks',
    'events',
    'progress',
    'ai',
    'admin',
    'settings',
  ]),
};

export const useUiStore = create<UiState>()((set, get) => ({
  sidebarOpen: false,
  riderType: 'street',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setRiderType: (type) => set({ riderType: type }),

  isNavVisible: (item) => {
    const { riderType } = get();
    return NAV_VISIBILITY[riderType].has(item);
  },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { useUiStore } from '@/stores/uiStore';
import type { UserProfile } from '@/api/types';

const mockUser: UserProfile = {
  id: 'user-1',
  email: 'rider@dialed.app',
  display_name: 'Test Rider',
  rider_type: 'casual_track',
  skill_level: 'intermediate',
  units: 'imperial',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts with no token or user', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('login sets token, refreshToken, and user', () => {
    useAuthStore.getState().login('access-token', 'refresh-token', mockUser);
    const state = useAuthStore.getState();
    expect(state.token).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.user).toEqual(mockUser);
  });

  it('logout clears all auth state', () => {
    useAuthStore.getState().login('access-token', 'refresh-token', mockUser);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('setUser updates only the user', () => {
    useAuthStore.getState().login('access-token', 'refresh-token', mockUser);
    const updatedUser = { ...mockUser, display_name: 'Updated Name' };
    useAuthStore.getState().setUser(updatedUser);
    const state = useAuthStore.getState();
    expect(state.user?.display_name).toBe('Updated Name');
    expect(state.token).toBe('access-token');
  });

  it('setToken updates only the token', () => {
    useAuthStore.getState().login('old-token', 'refresh-token', mockUser);
    useAuthStore.getState().setToken('new-token');
    expect(useAuthStore.getState().token).toBe('new-token');
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });
});

describe('offlineStore', () => {
  beforeEach(async () => {
    await useOfflineStore.getState().clear();
  });

  it('starts with an empty queue', () => {
    expect(useOfflineStore.getState().queue).toEqual([]);
  });

  it('enqueue adds a mutation to the queue', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
      body: JSON.stringify({ make: 'Ducati', model: 'Panigale V4' }),
    });
    const queue = useOfflineStore.getState().queue;
    expect(queue).toHaveLength(1);
    expect(queue[0].endpoint).toBe('/garage/bikes');
    expect(queue[0].method).toBe('POST');
    expect(queue[0].id).toBeTruthy();
    expect(queue[0].timestamp).toBeGreaterThan(0);
  });

  it('dequeue removes and returns the first mutation', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
    });
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes/1',
      method: 'PATCH',
    });

    const first = await useOfflineStore.getState().dequeue();
    expect(first?.endpoint).toBe('/garage/bikes');
    expect(useOfflineStore.getState().queue).toHaveLength(1);

    const second = await useOfflineStore.getState().dequeue();
    expect(second?.endpoint).toBe('/garage/bikes/1');
    expect(useOfflineStore.getState().queue).toHaveLength(0);
  });

  it('dequeue returns undefined when queue is empty', async () => {
    const result = await useOfflineStore.getState().dequeue();
    expect(result).toBeUndefined();
  });

  it('peek returns the first mutation without removing it', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
    });
    const peeked = useOfflineStore.getState().peek();
    expect(peeked?.endpoint).toBe('/garage/bikes');
    expect(useOfflineStore.getState().queue).toHaveLength(1);
  });

  it('clear empties the queue', async () => {
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes',
      method: 'POST',
    });
    await useOfflineStore.getState().enqueue({
      endpoint: '/garage/bikes/1',
      method: 'PATCH',
    });
    await useOfflineStore.getState().clear();
    expect(useOfflineStore.getState().queue).toEqual([]);
  });
});

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: false, riderType: 'street' });
  });

  it('starts with sidebar closed', () => {
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('toggleSidebar flips the sidebar state', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('setSidebarOpen sets the sidebar to a specific state', () => {
    useUiStore.getState().setSidebarOpen(true);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().setSidebarOpen(false);
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('starts with street rider type', () => {
    expect(useUiStore.getState().riderType).toBe('street');
  });

  it('setRiderType updates the rider type', () => {
    useUiStore.getState().setRiderType('competitive');
    expect(useUiStore.getState().riderType).toBe('competitive');
  });

  it('isNavVisible returns correct items for street rider', () => {
    useUiStore.getState().setRiderType('street');
    const isVisible = useUiStore.getState().isNavVisible;
    expect(isVisible('garage')).toBe(true);
    expect(isVisible('settings')).toBe(true);
    expect(isVisible('sessions')).toBe(false);
    expect(isVisible('progress')).toBe(false);
    expect(isVisible('admin')).toBe(false);
  });

  it('isNavVisible returns correct items for casual_track rider', () => {
    useUiStore.getState().setRiderType('casual_track');
    const isVisible = useUiStore.getState().isNavVisible;
    expect(isVisible('garage')).toBe(true);
    expect(isVisible('sessions')).toBe(true);
    expect(isVisible('progress')).toBe(true);
    expect(isVisible('settings')).toBe(true);
    expect(isVisible('admin')).toBe(false);
  });

  it('isNavVisible returns correct items for competitive rider', () => {
    useUiStore.getState().setRiderType('competitive');
    const isVisible = useUiStore.getState().isNavVisible;
    expect(isVisible('garage')).toBe(true);
    expect(isVisible('sessions')).toBe(true);
    expect(isVisible('progress')).toBe(true);
    expect(isVisible('admin')).toBe(true);
    expect(isVisible('settings')).toBe(true);
  });
});

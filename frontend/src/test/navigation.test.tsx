import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/common/AppLayout';
import { useUiStore } from '@/stores/uiStore';

function renderWithNav(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<div data-testid="garage-page">Garage</div>} />
            <Route path="tracks" element={<div data-testid="tracks-page">Tracks</div>} />
            <Route path="events" element={<div data-testid="events-page">Events</div>} />
            <Route path="sessions/new" element={<div data-testid="sessions-page">Sessions</div>} />
            <Route path="progress" element={<div data-testid="progress-page">Progress</div>} />
            <Route path="admin" element={<div data-testid="admin-page">Admin</div>} />
            <Route path="settings" element={<div data-testid="settings-page">Settings</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Navigation by rider_type', () => {
  beforeEach(() => {
    // Reset store state
    useUiStore.setState({ riderType: 'street', sidebarOpen: false });
  });

  it('street rider sees only Garage and Settings in sidebar nav', () => {
    useUiStore.setState({ riderType: 'street' });
    renderWithNav('/');

    const nav = screen.getByTestId('sidebar-nav');
    const links = nav.querySelectorAll('a');
    const labels = Array.from(links).map((a) => a.textContent?.trim());

    expect(labels).toContain('Garage');
    expect(labels).toContain('Settings');
    expect(labels).not.toContain('Progress');
    expect(labels).not.toContain('Admin');
    expect(labels).not.toContain('Sessions');
    expect(labels).not.toContain('Tracks');
    expect(labels).not.toContain('Events');
  });

  it('casual_track rider sees Garage, Tracks, Events, Sessions, Progress, Settings', () => {
    useUiStore.setState({ riderType: 'casual_track' });
    renderWithNav('/');

    const nav = screen.getByTestId('sidebar-nav');
    const links = nav.querySelectorAll('a');
    const labels = Array.from(links).map((a) => a.textContent?.trim());

    expect(labels).toContain('Garage');
    expect(labels).toContain('Tracks');
    expect(labels).toContain('Events');
    expect(labels).toContain('Sessions');
    expect(labels).toContain('Progress');
    expect(labels).toContain('Settings');
    expect(labels).not.toContain('Admin');
  });

  it('competitive rider sees all nav items including Admin', () => {
    useUiStore.setState({ riderType: 'competitive' });
    renderWithNav('/');

    const nav = screen.getByTestId('sidebar-nav');
    const links = nav.querySelectorAll('a');
    const labels = Array.from(links).map((a) => a.textContent?.trim());

    expect(labels).toContain('Garage');
    expect(labels).toContain('Tracks');
    expect(labels).toContain('Events');
    expect(labels).toContain('Sessions');
    expect(labels).toContain('Progress');
    expect(labels).toContain('Admin');
    expect(labels).toContain('Settings');
  });

  it('street rider can still access admin page via URL', () => {
    useUiStore.setState({ riderType: 'street' });
    renderWithNav('/admin');

    // Admin page is rendered even though nav link is not shown
    expect(screen.getByTestId('admin-page')).toBeInTheDocument();

    // But Admin is not in the nav
    const nav = screen.getByTestId('sidebar-nav');
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(labels).not.toContain('Admin');
  });

  it('street rider can access progress page via URL', () => {
    useUiStore.setState({ riderType: 'street' });
    renderWithNav('/progress');

    expect(screen.getByTestId('progress-page')).toBeInTheDocument();

    const nav = screen.getByTestId('sidebar-nav');
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(labels).not.toContain('Progress');
  });

  it('renders bottom nav on mobile with up to 5 items', () => {
    useUiStore.setState({ riderType: 'competitive' });
    renderWithNav('/');

    const bottomNav = screen.getByTestId('bottom-nav');
    const links = bottomNav.querySelectorAll('a');
    // Bottom nav shows up to 5 items (sliced from visible entries)
    expect(links.length).toBeLessThanOrEqual(5);
  });

  it('active route is highlighted in sidebar', () => {
    useUiStore.setState({ riderType: 'competitive' });
    renderWithNav('/progress');

    const nav = screen.getByTestId('sidebar-nav');
    const progressLink = Array.from(nav.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Progress'
    );
    expect(progressLink).toBeTruthy();
    expect(progressLink?.className).toContain('bg-blue-50');
  });
});

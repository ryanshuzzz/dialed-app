import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BikeDetail from '@/screens/BikeDetail';
import type { BikeDetail as BikeDetailType } from '@/api/types';

const mockBikeDetail: BikeDetailType = {
  id: 'bike-1',
  user_id: 'user-1',
  make: 'Ducati',
  model: 'Panigale V4 R',
  year: 2024,
  color: 'Red',
  mileage_km: 4200,
  engine_hours: 82,
  exhaust: 'Akrapovic Full System',
  ecu: 'Ducati Performance',
  gearing_front: 16,
  gearing_rear: 42,
  suspension_spec: {
    schema_version: 1,
    front: {
      compression: 12,
      rebound: 14,
      preload: 8,
    },
    rear: {
      compression: 10,
      rebound: 12,
      preload: 6,
    },
  },
  notes: 'Track-prepped. Rearsets swapped to Woodcraft GP.',
  status: 'owned',
  created_at: '2024-03-15T10:00:00Z',
  updated_at: '2025-12-20T08:30:00Z',
  stats: {
    maintenance_count: 12,
    modification_count: 8,
    session_count: 24,
    best_lap_ms: 98432,
  },
};

function renderBikeDetail(bikeId = 'bike-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/bikes/${bikeId}`]}>
        <Routes>
          <Route path="/" element={<div>Garage</div>} />
          <Route path="/bikes/:id" element={<BikeDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('BikeDetail screen', () => {
  it('renders the overview tab with bike info', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('bike-title')).toHaveTextContent('2024 Ducati Panigale V4 R');
    });

    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
    expect(screen.getByTestId('exhaust-value')).toHaveTextContent('Akrapovic Full System');
    expect(screen.getByTestId('ecu-value')).toHaveTextContent('Ducati Performance');
    expect(screen.getByTestId('gearing-value')).toHaveTextContent('16/42');
  });

  it('displays the suspension spec card', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('suspension-spec-card')).toBeInTheDocument();
    });

    // Check suspension sections are rendered (front and rear both have these labels)
    expect(screen.getByText('Front')).toBeInTheDocument();
    expect(screen.getByText('Rear')).toBeInTheDocument();
    // Compression appears for both front and rear
    expect(screen.getAllByText('Compression')).toHaveLength(2);
    expect(screen.getAllByText('Rebound')).toHaveLength(2);
  });

  it('shows stats bar with counts', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByText('98.432s')).toBeInTheDocument(); // best_lap_ms
    });
    // Best Lap label only appears in stats bar, not in tabs
    expect(screen.getByText('Best Lap')).toBeInTheDocument();
    // Verify the formatted best lap value
    expect(screen.getByText('98.432s')).toBeInTheDocument();
  });

  it('displays notes', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('bike-notes')).toHaveTextContent(
        'Track-prepped. Rearsets swapped to Woodcraft GP.',
      );
    });
  });

  it('toggles edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('edit-button'));

    expect(screen.getByTestId('edit-form')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('cancels edit mode', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('edit-button'));
    expect(screen.getByTestId('edit-form')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('edit-form')).not.toBeInTheDocument();
  });

  it('switches tabs', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikeDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('tab-nav')).toBeInTheDocument();
    });

    // Use within() to scope clicks to the tab nav area to avoid ambiguity
    const tabNav = screen.getByTestId('tab-nav');
    const getTabButton = (name: string) => {
      const buttons = tabNav.querySelectorAll('button');
      return Array.from(buttons).find((b) => b.textContent === name)!;
    };

    await user.click(getTabButton('Maintenance'));
    expect(screen.getByTestId('maintenance-tab')).toBeInTheDocument();

    await user.click(getTabButton('Tires'));
    expect(screen.getByTestId('tires-tab')).toBeInTheDocument();

    await user.click(getTabButton('Overview'));
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => {})); // Never resolves
    renderBikeDetail();
    expect(screen.getByText('Loading bike details...')).toBeInTheDocument();
  });
});

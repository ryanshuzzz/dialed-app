import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BikeDetail from '@/screens/BikeDetail';
import type { BikeDetail as BikeDetailType, TirePressureLog, Modification, OwnershipHistory } from '@/api/types';

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
    front: { compression: 12, rebound: 14, preload: 8 },
    rear: { compression: 10, rebound: 12, preload: 6 },
  },
  notes: 'Track-prepped.',
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

const mockTirePressure: TirePressureLog[] = [
  {
    id: 'tp-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 32.5,
    rear_psi: 30.0,
    front_temp_c: 25,
    rear_temp_c: 25,
    context: 'cold',
    session_id: null,
    notes: 'Morning check',
    recorded_at: '2026-01-15T08:00:00Z',
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    id: 'tp-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 34.0,
    rear_psi: 31.5,
    front_temp_c: 45,
    rear_temp_c: 50,
    context: 'pre_session',
    session_id: 'session-1',
    notes: null,
    recorded_at: '2026-01-20T10:00:00Z',
    created_at: '2026-01-20T10:00:00Z',
  },
];

const mockModifications: Modification[] = [
  {
    id: 'mod-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    action: 'installed',
    category: 'exhaust',
    part_name: 'Full System Exhaust',
    brand: 'Akrapovic',
    part_number: null,
    cost: 2850.0,
    currency: '$',
    installed_at: '2025-06-15T00:00:00Z',
    removed_at: null,
    mileage_km: 1200,
    notes: null,
    created_at: '2025-06-15T10:00:00Z',
    updated_at: '2025-06-15T10:00:00Z',
  },
  {
    id: 'mod-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    action: 'removed',
    category: 'bodywork',
    part_name: 'OEM Mirrors',
    brand: 'Ducati',
    part_number: null,
    cost: null,
    currency: null,
    installed_at: '2024-03-15T00:00:00Z',
    removed_at: '2025-05-01T00:00:00Z',
    mileage_km: null,
    notes: null,
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-05-01T10:00:00Z',
  },
];

const mockOwnership: OwnershipHistory[] = [
  {
    id: 'own-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    event_type: 'purchased',
    date: '2024-03-15',
    price: 28500,
    currency: '$',
    mileage_km: 0,
    counterparty: 'Bay Area Motorsports',
    notes: null,
    created_at: '2024-03-15T10:00:00Z',
  },
];

function renderBikeDetail() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bikes/bike-1']}>
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

function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('BikeDetail tabs', () => {
  it('switches between all tabs and each renders content', async () => {
    const user = userEvent.setup();

    // BikeDetail fetch
    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockBikeDetail));

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('bike-title')).toBeInTheDocument();
    });

    const tabNav = screen.getByTestId('tab-nav');
    const getTabButton = (name: string) => {
      const buttons = tabNav.querySelectorAll('button');
      return Array.from(buttons).find((b) => b.textContent === name)!;
    };

    // Overview tab (default)
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();

    // Switch to Tires tab
    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockTirePressure));
    await user.click(getTabButton('Tires'));
    expect(screen.getByTestId('tires-tab')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('tire-pressure-chart')).toBeInTheDocument();
    });

    // Switch to Mods tab
    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockModifications));
    await user.click(getTabButton('Mods'));
    expect(screen.getByTestId('mods-tab')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Full System Exhaust')).toBeInTheDocument();
    });

    // Switch to Ownership tab
    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockOwnership));
    await user.click(getTabButton('Ownership'));
    expect(screen.getByTestId('ownership-tab')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Bay Area Motorsports')).toBeInTheDocument();
    });

    // Switch to Sessions tab
    await user.click(getTabButton('Sessions'));
    expect(screen.getByTestId('sessions-tab')).toBeInTheDocument();

    // Back to Overview
    await user.click(getTabButton('Overview'));
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  it('renders tire pressure readings with context badges', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockBikeDetail));

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('bike-title')).toBeInTheDocument();
    });

    const tabNav = screen.getByTestId('tab-nav');
    const tiresButton = Array.from(tabNav.querySelectorAll('button')).find(
      (b) => b.textContent === 'Tires',
    )!;

    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockTirePressure));
    await user.click(tiresButton);

    await waitFor(() => {
      expect(screen.getByTestId('tire-pressure-list')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('context-badge');
    expect(badges.length).toBe(2);
  });

  it('renders mods with installed and removed sections', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockBikeDetail));

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('bike-title')).toBeInTheDocument();
    });

    const tabNav = screen.getByTestId('tab-nav');
    const modsButton = Array.from(tabNav.querySelectorAll('button')).find(
      (b) => b.textContent === 'Mods',
    )!;

    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockModifications));
    await user.click(modsButton);

    await waitFor(() => {
      expect(screen.getByTestId('installed-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('removed-section')).toBeInTheDocument();
    expect(screen.getAllByTestId('mod-row')).toHaveLength(2);
  });

  it('renders ownership timeline with events', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockBikeDetail));

    renderBikeDetail();

    await waitFor(() => {
      expect(screen.getByTestId('bike-title')).toBeInTheDocument();
    });

    const tabNav = screen.getByTestId('tab-nav');
    const ownershipButton = Array.from(tabNav.querySelectorAll('button')).find(
      (b) => b.textContent === 'Ownership',
    )!;

    fetchSpy.mockResolvedValueOnce(mockFetchResponse(mockOwnership));
    await user.click(ownershipButton);

    await waitFor(() => {
      expect(screen.getByTestId('ownership-list')).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('ownership-event')).toHaveLength(1);
    expect(screen.getByTestId('event-type-badge')).toHaveTextContent('Purchased');
  });
});

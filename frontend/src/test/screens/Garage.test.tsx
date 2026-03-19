import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Garage from '@/screens/Garage';
import type { Bike } from '@/api/types';

const mockBike1: Bike = {
  id: 'bike-1',
  user_id: 'user-1',
  make: 'Ducati',
  model: 'Panigale V4 R',
  year: 2024,
  color: 'Red',
  mileage_km: 4200,
  exhaust: 'Akrapovic Full System',
  suspension_spec: { schema_version: 1 },
  status: 'owned',
  created_at: '2024-03-15T10:00:00Z',
  updated_at: '2025-12-20T08:30:00Z',
};

const mockBike2: Bike = {
  id: 'bike-2',
  user_id: 'user-1',
  make: 'Yamaha',
  model: 'YZF-R1',
  year: 2023,
  color: 'Blue',
  mileage_km: 11200,
  suspension_spec: { schema_version: 1 },
  status: 'owned',
  created_at: '2023-06-01T12:00:00Z',
  updated_at: '2025-11-10T14:00:00Z',
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/bikes/:id" element={<div>Bike Detail</div>} />
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

describe('Garage screen', () => {
  it('renders the bike list', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockBike1, mockBike2]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByText(/Panigale V4 R/)).toBeInTheDocument();
    });
    expect(screen.getByText(/YZF-R1/)).toBeInTheDocument();
    expect(screen.getAllByTestId('bike-card')).toHaveLength(2);
  });

  it('shows empty state when no bikes exist', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No bikes yet')).toBeInTheDocument();
  });

  it('opens add bike modal and submits the form', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('add-bike-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('add-bike-button'));

    expect(screen.getByTestId('add-bike-form')).toBeInTheDocument();

    // Fill out the form
    await user.type(screen.getByLabelText('Make *'), 'Honda');
    await user.type(screen.getByLabelText('Model *'), 'CBR1000RR-R');

    // Mock the create response
    const newBike: Bike = {
      ...mockBike1,
      id: 'bike-new',
      make: 'Honda',
      model: 'CBR1000RR-R',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(newBike), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    // Mock the refetch after invalidation
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([newBike]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    // Click the submit button inside the form
    const form = screen.getByTestId('add-bike-form');
    const submitButton = form.querySelector('button[type="submit"]')!;
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByTestId('add-bike-form')).not.toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => {})); // Never resolves
    renderWithProviders(<Garage />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });
});

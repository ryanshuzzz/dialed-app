import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Garage from '@/screens/Garage';

function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="*" element={ui} />
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

const mockBikes = [
  { id: 'b1', make: 'Ducati', model: 'Panigale V4', year: 2024, color: 'Red', mileage_km: 500, status: 'owned', suspension_spec: { schema_version: 1 }, stats: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'b2', make: 'Yamaha', model: 'R1', year: 2023, color: 'Blue', mileage_km: 1200, status: 'owned', suspension_spec: { schema_version: 1 }, stats: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 'b3', make: 'Kawasaki', model: 'ZX-10R', year: 2022, color: 'Green', mileage_km: 3000, status: 'owned', suspension_spec: { schema_version: 1 }, stats: null, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

describe('Responsive design', () => {
  it('Garage bike grid uses responsive grid classes', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikes), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('bike-grid')).toBeInTheDocument();
    });

    const grid = screen.getByTestId('bike-grid');
    // Verify responsive grid classes are present: single col mobile, 2-col md, 3-col lg
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
  });

  it('Add Bike button has minimum touch target size', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBikes), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Garage />);

    await waitFor(() => {
      expect(screen.getByTestId('add-bike-button')).toBeInTheDocument();
    });

    const button = screen.getByTestId('add-bike-button');
    expect(button.className).toContain('min-h-[44px]');
  });

  it('form inputs have minimum touch target size', async () => {
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

    // Open the modal
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('add-bike-button'));

    await waitFor(() => {
      expect(screen.getByTestId('add-bike-form')).toBeInTheDocument();
    });

    const makeInput = screen.getByLabelText('Make *');
    expect(makeInput.className).toContain('min-h-[44px]');
  });
});

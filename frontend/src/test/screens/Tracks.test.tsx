import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Tracks from '@/screens/Tracks';
import type { Track } from '@/api/types';

const mockTrack1: Track = {
  id: 'track-1',
  name: 'Mugello',
  config: 'Full Circuit',
  surface_notes: 'Smooth asphalt, high grip.',
  gps_bounds: null,
  created_at: '2024-01-10T08:00:00Z',
  updated_at: '2025-06-15T10:00:00Z',
};

const mockTrack2: Track = {
  id: 'track-2',
  name: 'Phillip Island',
  config: 'Grand Prix Circuit',
  surface_notes: 'Exposed to wind.',
  gps_bounds: null,
  created_at: '2024-02-20T12:00:00Z',
  updated_at: '2025-08-10T14:00:00Z',
};

const mockTrack3: Track = {
  id: 'track-3',
  name: 'COTA',
  config: 'Full Course',
  surface_notes: 'Bumpy in sectors 2-3.',
  gps_bounds: null,
  created_at: '2024-04-05T09:00:00Z',
  updated_at: '2025-09-01T11:00:00Z',
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
      <MemoryRouter initialEntries={['/tracks']}>
        <Routes>
          <Route path="/tracks" element={ui} />
          <Route path="/tracks/:id" element={<div>Track Detail</div>} />
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

describe('Tracks screen', () => {
  it('renders the track list', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockTrack1, mockTrack2, mockTrack3]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Tracks />);

    await waitFor(() => {
      expect(screen.getByText('Mugello')).toBeInTheDocument();
    });
    expect(screen.getByText('Phillip Island')).toBeInTheDocument();
    expect(screen.getByText('COTA')).toBeInTheDocument();
    expect(screen.getAllByTestId('track-card')).toHaveLength(3);
  });

  it('shows empty state when no tracks exist', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Tracks />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No tracks yet')).toBeInTheDocument();
  });

  it('opens add track modal and submits the form', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Tracks />);

    await waitFor(() => {
      expect(screen.getByTestId('add-track-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('add-track-button'));
    expect(screen.getByTestId('add-track-form')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name *'), 'Silverstone');

    const newTrack: Track = {
      ...mockTrack1,
      id: 'track-new',
      name: 'Silverstone',
    };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(newTrack), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([newTrack]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const form = screen.getByTestId('add-track-form');
    const submitButton = form.querySelector('button[type="submit"]')!;
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByTestId('add-track-form')).not.toBeInTheDocument();
    });
  });

  it('filters tracks by search input', async () => {
    const user = userEvent.setup();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([mockTrack1, mockTrack2, mockTrack3]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithProviders(<Tracks />);

    await waitFor(() => {
      expect(screen.getAllByTestId('track-card')).toHaveLength(3);
    });

    const searchInput = screen.getByTestId('track-search');
    await user.type(searchInput, 'mugello');

    expect(screen.getAllByTestId('track-card')).toHaveLength(1);
    expect(screen.getByText('Mugello')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    fetchSpy.mockReturnValueOnce(new Promise(() => {}));
    renderWithProviders(<Tracks />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });
});

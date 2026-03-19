import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Events from '@/screens/Events';
import type { TrackEvent, Bike, Track } from '@/api/types';

const mockBikes: Bike[] = [
  {
    id: 'bike-1',
    user_id: 'user-1',
    make: 'Ducati',
    model: 'Panigale V4 R',
    year: 2024,
    suspension_spec: { schema_version: 1 },
    status: 'owned',
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2025-12-20T08:30:00Z',
  },
  {
    id: 'bike-2',
    user_id: 'user-1',
    make: 'Yamaha',
    model: 'YZF-R1',
    year: 2023,
    suspension_spec: { schema_version: 1 },
    status: 'owned',
    created_at: '2023-06-01T12:00:00Z',
    updated_at: '2025-11-10T14:00:00Z',
  },
];

const mockTracks: Track[] = [
  {
    id: 'track-1',
    name: 'Mugello',
    config: 'Full Circuit',
    surface_notes: null,
    gps_bounds: null,
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2025-06-15T10:00:00Z',
  },
  {
    id: 'track-2',
    name: 'Phillip Island',
    config: null,
    surface_notes: null,
    gps_bounds: null,
    created_at: '2024-02-20T12:00:00Z',
    updated_at: '2025-08-10T14:00:00Z',
  },
];

const mockEvents: TrackEvent[] = [
  {
    id: 'event-1',
    user_id: 'user-1',
    bike_id: 'bike-1',
    track_id: 'track-1',
    date: '2025-09-12',
    conditions: {
      temp_c: 28,
      humidity_pct: 45,
      condition: 'dry',
    },
    created_at: '2025-09-10T08:00:00Z',
    updated_at: '2025-09-12T18:00:00Z',
  },
  {
    id: 'event-2',
    user_id: 'user-1',
    bike_id: 'bike-2',
    track_id: 'track-2',
    date: '2025-10-05',
    conditions: {
      temp_c: 18,
      condition: 'damp',
    },
    created_at: '2025-10-03T10:00:00Z',
    updated_at: '2025-10-05T16:00:00Z',
  },
];

/**
 * The Events screen makes 3 parallel requests on mount:
 *   1. GET /garage/events (events list)
 *   2. GET /garage/bikes  (for bike names)
 *   3. GET /garage/tracks (for track names)
 *
 * We need to mock all three. The order depends on which query fires first;
 * we use `mockImplementation` to route by URL.
 */
function mockFetchForEvents(
  events: TrackEvent[],
  bikes: Bike[] = mockBikes,
  tracks: Track[] = mockTracks,
) {
  return (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/garage/events')) {
      return Promise.resolve(
        new Response(JSON.stringify(events), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (url.includes('/garage/bikes')) {
      return Promise.resolve(
        new Response(JSON.stringify(bikes), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (url.includes('/garage/tracks')) {
      return Promise.resolve(
        new Response(JSON.stringify(tracks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/events']}>
        <Routes>
          <Route path="/events" element={ui} />
          <Route path="/events/:id" element={<div>Event Detail</div>} />
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

describe('Events screen', () => {
  it('renders the event list with track and bike names', async () => {
    fetchSpy.mockImplementation(mockFetchForEvents(mockEvents));

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getByText('2025-09-12')).toBeInTheDocument();
    });
    expect(screen.getByText('2025-10-05')).toBeInTheDocument();
    // Track names appear in both filter dropdown options and event cards
    expect(screen.getAllByText('Mugello').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Phillip Island').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('event-card')).toHaveLength(2);
  });

  it('shows empty state when no events exist', async () => {
    fetchSpy.mockImplementation(mockFetchForEvents([]));

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('filters events by bike', async () => {
    const user = userEvent.setup();

    // Initial load returns all events
    const fetchImpl = mockFetchForEvents(mockEvents);
    fetchSpy.mockImplementation(fetchImpl);

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getAllByTestId('event-card')).toHaveLength(2);
    });

    // When bike filter is selected, the query re-fires with bike_id param.
    // The mock returns a filtered list for the second fetch.
    const filteredEvents = mockEvents.filter((e) => e.bike_id === 'bike-1');
    const filteredFetchImpl = mockFetchForEvents(filteredEvents);
    fetchSpy.mockImplementation(filteredFetchImpl);

    const bikeFilter = screen.getByTestId('filter-bike');
    await user.selectOptions(bikeFilter, 'bike-1');

    await waitFor(() => {
      expect(screen.getAllByTestId('event-card')).toHaveLength(1);
    });
    expect(screen.getByText('2025-09-12')).toBeInTheDocument();
  });

  it('filters events by track', async () => {
    const user = userEvent.setup();

    fetchSpy.mockImplementation(mockFetchForEvents(mockEvents));

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getAllByTestId('event-card')).toHaveLength(2);
    });

    const filteredEvents = mockEvents.filter((e) => e.track_id === 'track-2');
    fetchSpy.mockImplementation(mockFetchForEvents(filteredEvents));

    const trackFilter = screen.getByTestId('filter-track');
    await user.selectOptions(trackFilter, 'track-2');

    await waitFor(() => {
      expect(screen.getAllByTestId('event-card')).toHaveLength(1);
    });
    expect(screen.getByText('2025-10-05')).toBeInTheDocument();
  });

  it('opens add event form and validates required fields', async () => {
    const user = userEvent.setup();

    fetchSpy.mockImplementation(mockFetchForEvents([]));

    renderWithProviders(<Events />);

    await waitFor(() => {
      expect(screen.getByTestId('add-event-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('add-event-button'));
    expect(screen.getByTestId('add-event-form')).toBeInTheDocument();

    // Verify the selectors populate with bikes and tracks
    expect(screen.getByLabelText('Bike *')).toBeInTheDocument();
    expect(screen.getByLabelText('Track *')).toBeInTheDocument();
    expect(screen.getByLabelText('Date *')).toBeInTheDocument();

    // Verify conditions fields exist
    expect(screen.getByLabelText('Temp (C)')).toBeInTheDocument();
    expect(screen.getByLabelText('Humidity (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Track Temp (C)')).toBeInTheDocument();
    expect(screen.getByLabelText('Wind (kph)')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    fetchSpy.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<Events />);
    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });
});

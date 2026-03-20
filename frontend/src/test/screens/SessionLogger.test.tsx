import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SessionLogger from '@/screens/SessionLogger';
import type { Bike, Track, TrackEvent, Session } from '@/api/types';

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
];

const mockTracks: Track[] = [
  {
    id: 'track-1',
    name: 'Laguna Seca',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockEvents: TrackEvent[] = [
  {
    id: 'event-1',
    user_id: 'user-1',
    bike_id: 'bike-1',
    venue: 'track',
    track_id: 'track-1',
    ride_location: null,
    date: '2025-09-12',
    conditions: { condition: 'dry' },
    created_at: '2025-09-10T08:00:00Z',
    updated_at: '2025-09-12T18:00:00Z',
  },
];

function mockResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
      <MemoryRouter initialEntries={['/sessions/new']}>
        <Routes>
          <Route path="/sessions/new" element={ui} />
          <Route path="/sessions/:id" element={<div data-testid="session-detail-page">Session Detail</div>} />
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

function setupStandardFetches(extraHandler?: (url: string, method: string) => Response | undefined) {
  fetchSpy.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';

    if (extraHandler) {
      const result = extraHandler(url, method);
      if (result) return Promise.resolve(result);
    }

    if (url.includes('/garage/bikes')) {
      return Promise.resolve(mockResponse(mockBikes));
    }
    if (url.includes('/garage/tracks')) {
      return Promise.resolve(mockResponse(mockTracks));
    }
    if (url.includes('/garage/events') && method === 'GET') {
      return Promise.resolve(mockResponse(mockEvents));
    }
    if (url.includes('/sessions') && method === 'POST') {
      const newSession: Session = {
        id: 'session-new',
        event_id: 'event-1',
        user_id: 'user-1',
        session_type: 'practice',
        manual_best_lap_ms: null,
        csv_best_lap_ms: null,
        tire_front: null,
        tire_rear: null,
        rider_feedback: null,
        voice_note_url: null,
        ride_metrics: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return Promise.resolve(mockResponse(newSession, 201));
    }
    return Promise.resolve(mockResponse({}));
  });
}

async function waitForEventsLoaded() {
  await waitFor(() => {
    const select = screen.getByTestId('event-select');
    expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
  });
}

describe('SessionLogger screen', () => {
  it('renders the step wizard with Event step active', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionLogger />);

    await waitFor(() => {
      expect(screen.getByTestId('session-logger')).toBeInTheDocument();
    });
    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('step-event')).toBeInTheDocument();
    expect(screen.getByText('Select or Create Event')).toBeInTheDocument();
    expect(screen.getByTestId('venue-track')).toBeInTheDocument();
    expect(screen.getByTestId('venue-road')).toBeInTheDocument();
  });

  it('navigates from Event to Details step', async () => {
    const user = userEvent.setup();
    setupStandardFetches();

    renderWithProviders(<SessionLogger />);

    await waitForEventsLoaded();

    await user.selectOptions(screen.getByTestId('event-select'), 'event-1');
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-details')).toBeInTheDocument();
    });
    expect(screen.getByText('Session Details')).toBeInTheDocument();
  });

  it('navigates through all steps', async () => {
    const user = userEvent.setup();
    setupStandardFetches();

    renderWithProviders(<SessionLogger />);

    await waitForEventsLoaded();
    await user.selectOptions(screen.getByTestId('event-select'), 'event-1');
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-details')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-upload')).toBeInTheDocument();
    });
    expect(screen.getByText('Upload Data')).toBeInTheDocument();
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });
    expect(screen.getByText('Review & Save')).toBeInTheDocument();
  });

  it('creates a session from the review step', async () => {
    const user = userEvent.setup();
    setupStandardFetches();

    renderWithProviders(<SessionLogger />);

    await waitForEventsLoaded();
    await user.selectOptions(screen.getByTestId('event-select'), 'event-1');
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-details')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-upload')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('save-session'));

    await waitFor(() => {
      expect(screen.getByTestId('session-detail-page')).toBeInTheDocument();
    });
  });

  it('shows file upload inputs on the upload step', async () => {
    const user = userEvent.setup();
    setupStandardFetches();

    renderWithProviders(<SessionLogger />);

    await waitForEventsLoaded();
    await user.selectOptions(screen.getByTestId('event-select'), 'event-1');
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-details')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-upload')).toBeInTheDocument();
    });

    expect(screen.getByTestId('csv-upload')).toBeInTheDocument();
    expect(screen.getByTestId('ocr-upload')).toBeInTheDocument();
    expect(screen.getByTestId('voice-upload')).toBeInTheDocument();
  });

  it('road flow: skip upload, save with ride_metrics in POST body', async () => {
    const user = userEvent.setup();
    const roadEvent: TrackEvent = {
      id: 'event-road-x',
      user_id: 'user-1',
      bike_id: 'bike-1',
      venue: 'road',
      track_id: null,
      ride_location: { label: 'Test loop' },
      date: '2026-03-01',
      conditions: {},
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    };

    fetchSpy.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? 'GET';

      if (url.includes('/garage/bikes')) return Promise.resolve(mockResponse(mockBikes));
      if (url.includes('/garage/tracks')) return Promise.resolve(mockResponse(mockTracks));
      if (url.includes('/garage/events') && method === 'GET') {
        return Promise.resolve(mockResponse([roadEvent]));
      }
      if (url.includes('/sessions') && method === 'POST') {
        return Promise.resolve(
          mockResponse(
            {
              id: 'session-road-new',
              event_id: 'event-road-x',
              user_id: 'user-1',
              session_type: 'road',
              manual_best_lap_ms: null,
              csv_best_lap_ms: null,
              tire_front: null,
              tire_rear: null,
              rider_feedback: null,
              voice_note_url: null,
              ride_metrics: {
                distance_km: 10,
                duration_ms: 30 * 60 * 1000,
                fuel_used_l: null,
                odometer_km: null,
                fuel_efficiency_l_per_100km: null,
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            201,
          ),
        );
      }
      return Promise.resolve(mockResponse({}));
    });

    renderWithProviders(<SessionLogger />);

    await user.click(screen.getByTestId('venue-road'));
    await waitFor(() => {
      expect(screen.getByTestId('event-select').querySelectorAll('option').length).toBeGreaterThan(1);
    });
    await user.selectOptions(screen.getByTestId('event-select'), 'event-road-x');
    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-details')).toBeInTheDocument();
    });

    const typeSelect = screen.getByTestId('session-type-select');
    expect(typeSelect.querySelectorAll('option').length).toBe(3);

    await user.type(screen.getByTestId('ride-metric-distance'), '10');
    await user.type(screen.getByTestId('ride-metric-duration'), '30');

    await user.click(screen.getByTestId('next-button'));

    await waitFor(() => {
      expect(screen.getByTestId('skip-upload-button')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('skip-upload-button'));

    await waitFor(() => {
      expect(screen.getByTestId('step-review')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('save-session'));

    await waitFor(() => {
      expect(screen.getByTestId('session-detail-page')).toBeInTheDocument();
    });

    const postCalls = fetchSpy.mock.calls.filter((c: Parameters<typeof fetch>) => {
      const url = typeof c[0] === 'string' ? c[0] : '';
      const init = c[1] as RequestInit | undefined;
      return url.includes('/sessions') && init?.method === 'POST';
    });
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse((postCalls[postCalls.length - 1][1] as RequestInit).body as string);
    expect(body.session_type).toBe('road');
    expect(body.ride_metrics).toEqual({
      distance_km: 10,
      duration_ms: 30 * 60 * 1000,
    });
  });
});

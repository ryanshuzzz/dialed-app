import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SessionDetail from '@/screens/SessionDetail';
import type { SessionDetail as SessionDetailType, SuggestionSummary, Suggestion, ChannelSummary, SessionAnalysis } from '@/api/types';

const mockSession: SessionDetailType = {
  id: 'session-1',
  event_id: 'event-1',
  user_id: 'user-1',
  session_type: 'practice',
  manual_best_lap_ms: 98432,
  csv_best_lap_ms: 97850,
  tire_front: { brand: 'Pirelli', compound: 'SC1', laps: 45 },
  tire_rear: { brand: 'Pirelli', compound: 'SC2', laps: 45 },
  rider_feedback: 'Front end feels planted but rear is sliding on exit of T4.',
  voice_note_url: null,
  created_at: '2025-09-12T09:00:00Z',
  updated_at: '2025-09-12T12:00:00Z',
  snapshots: [
    {
      id: 'snap-1',
      session_id: 'session-1',
      settings: {
        schema_version: 1,
        front: { compression: 12, rebound: 14, preload: 8 },
        rear: { compression: 10, rebound: 12, preload: 6 },
      },
      created_at: '2025-09-12T09:00:00Z',
    },
  ],
  changes: [
    {
      id: 'change-1',
      session_id: 'session-1',
      parameter: 'rear_rebound',
      from_value: '12',
      to_value: '14',
      rationale: 'Rear was kicking on exit.',
      applied_at: '2025-09-12T10:30:00Z',
    },
    {
      id: 'change-2',
      session_id: 'session-1',
      parameter: 'front_compression',
      from_value: '12',
      to_value: '10',
      rationale: 'Softening front to improve trail braking.',
      applied_at: '2025-09-12T11:00:00Z',
    },
  ],
};

const mockChanges = mockSession.changes!;

const mockSuggestionSummaries: SuggestionSummary[] = [
  {
    id: 'sug-1',
    session_id: 'session-1',
    user_id: 'user-1',
    suggestion_text: 'Based on your feedback about rear sliding...',
    change_count: 3,
    applied_count: 0,
    created_at: '2025-09-12T12:00:00Z',
  },
];

const mockSuggestion: Suggestion = {
  id: 'sug-1',
  session_id: 'session-1',
  user_id: 'user-1',
  suggestion_text: 'Based on your feedback about rear sliding...',
  changes: [
    {
      id: 'sc-1',
      suggestion_id: 'sug-1',
      parameter: 'rear_rebound',
      suggested_value: '16',
      symptom: 'Rear kicks on corner exit',
      confidence: 0.87,
      applied_status: 'not_applied',
      actual_value: null,
      outcome_lap_delta_ms: null,
      applied_at: null,
      created_at: '2025-09-12T12:00:00Z',
    },
    {
      id: 'sc-2',
      suggestion_id: 'sug-1',
      parameter: 'front_compression',
      suggested_value: '9',
      symptom: 'Front dives under braking',
      confidence: 0.72,
      applied_status: 'not_applied',
      actual_value: null,
      outcome_lap_delta_ms: null,
      applied_at: null,
      created_at: '2025-09-12T12:00:00Z',
    },
  ],
  created_at: '2025-09-12T12:00:00Z',
};

const mockChannels: ChannelSummary = {
  channels: [
    { name: 'gps_speed', min: 0, max: 285, sample_count: 12000 },
    { name: 'throttle_pos', min: 0, max: 100, sample_count: 12000 },
  ],
  total_samples: 24000,
  time_range: { start: '2025-09-12T09:00:00Z', end: '2025-09-12T09:05:00Z' },
};

const mockAnalysis: SessionAnalysis = {
  session_id: 'session-1',
  lap_segments: [
    {
      id: 'seg-1',
      session_id: 'session-1',
      lap_number: 1,
      start_time_ms: 0,
      end_time_ms: 98432,
      lap_time_ms: 98432,
      beacon_start_s: null,
      beacon_end_s: null,
      created_at: '2025-09-12T09:00:00Z',
    },
  ],
  best_lap: { lap_number: 1, lap_time_ms: 98432 },
  braking_zones: [],
};

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
      <MemoryRouter initialEntries={['/sessions/session-1']}>
        <Routes>
          <Route path="/sessions/:id" element={ui} />
          <Route path="/" element={<div>Home</div>} />
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

// Helper: set up standard fetch responses for session detail page
function setupStandardFetches() {
  // The order may vary depending on which queries fire first.
  // We use a function-based mock to handle different URLs.
  fetchSpy.mockImplementation((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes('/sessions/session-1/changes')) {
      return Promise.resolve(mockResponse(mockChanges));
    }
    if (url.includes('/sessions/session-1') && !url.includes('/changes')) {
      return Promise.resolve(mockResponse(mockSession));
    }
    if (url.includes('/suggest/session/session-1')) {
      return Promise.resolve(mockResponse(mockSuggestionSummaries));
    }
    if (url.includes('/suggest/sug-1')) {
      return Promise.resolve(mockResponse(mockSuggestion));
    }
    if (url.includes('/telemetry/session-1/channels')) {
      return Promise.resolve(mockResponse(mockChannels));
    }
    if (url.includes('/telemetry/session-1/analysis')) {
      return Promise.resolve(mockResponse(mockAnalysis));
    }
    if (url.includes('/telemetry/session-1/lap/')) {
      return Promise.resolve(mockResponse({ session_id: 'session-1', lap_number: 1, points: [] }));
    }
    // Default: return empty
    return Promise.resolve(mockResponse({}));
  });
}

describe('SessionDetail screen', () => {
  it('renders session info with type badge and best lap', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByTestId('session-detail')).toBeInTheDocument();
    });

    expect(screen.getByTestId('session-type-badge')).toHaveTextContent('practice');
    expect(screen.getByTestId('best-lap')).toBeInTheDocument();
  });

  it('renders rider feedback', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByTestId('rider-feedback')).toBeInTheDocument();
    });
    expect(screen.getByTestId('rider-feedback')).toHaveTextContent('Front end feels planted');
  });

  it('renders change log entries', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByTestId('change-log')).toBeInTheDocument();
    });

    const entries = screen.getAllByTestId('change-log-entry');
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('renders setup snapshot', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByTestId('setup-snapshot-view')).toBeInTheDocument();
    });
  });

  it('shows Get AI Suggestion button', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByTestId('request-suggestion-button')).toBeInTheDocument();
    });
    expect(screen.getByTestId('request-suggestion-button')).toHaveTextContent('Get AI Suggestion');
  });

  it('shows suggestion summaries and loads changes on click', async () => {
    const user = userEvent.setup();
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getAllByTestId('suggestion-summary').length).toBeGreaterThanOrEqual(1);
    });

    // Click on the first suggestion to load its details
    await user.click(screen.getAllByTestId('suggestion-summary')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-changes')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('suggestion-card');
    expect(cards.length).toBe(2);
  });

  it('shows apply and skip buttons on suggestion cards', async () => {
    const user = userEvent.setup();
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getAllByTestId('suggestion-summary').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByTestId('suggestion-summary')[0]);

    await waitFor(() => {
      expect(screen.getAllByTestId('suggestion-card').length).toBe(2);
    });

    const applyButtons = screen.getAllByTestId('apply-button');
    const skipButtons = screen.getAllByTestId('skip-button');
    expect(applyButtons.length).toBe(2);
    expect(skipButtons.length).toBe(2);
  });

  it('renders loading state', () => {
    fetchSpy.mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithProviders(<SessionDetail />);
    expect(screen.getAllByTestId('loading-skeleton').length).toBeGreaterThan(0);
  });

  it('renders telemetry section when channels are available', async () => {
    setupStandardFetches();

    renderWithProviders(<SessionDetail />);

    await waitFor(() => {
      expect(screen.getByTestId('telemetry-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channel-toggle')).toBeInTheDocument();
  });
});

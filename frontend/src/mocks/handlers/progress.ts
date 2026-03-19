import { http, HttpResponse } from 'msw';
import type { ProgressOverview, EfficacyOverview, SessionHistory } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_PROGRESS: ProgressOverview = {
  lap_time_trend: [
    { session_id: 'sess-1', date: '2025-06-01', track_name: 'Barber Motorsports Park', best_lap_ms: 102500 },
    { session_id: 'sess-2', date: '2025-06-15', track_name: 'Barber Motorsports Park', best_lap_ms: 101200 },
    { session_id: 'sess-3', date: '2025-07-01', track_name: 'Road Atlanta', best_lap_ms: 95800 },
    { session_id: 'sess-4', date: '2025-07-20', track_name: 'Barber Motorsports Park', best_lap_ms: 100100 },
    { session_id: 'sess-5', date: '2025-08-05', track_name: 'Road Atlanta', best_lap_ms: 94200 },
    { session_id: 'sess-6', date: '2025-08-20', track_name: 'Barber Motorsports Park', best_lap_ms: 99400 },
  ],
  best_laps_by_track: [
    { track_id: 'track-1', track_name: 'Barber Motorsports Park', best_lap_ms: 99400, session_id: 'sess-6', date: '2025-08-20' },
    { track_id: 'track-2', track_name: 'Road Atlanta', best_lap_ms: 94200, session_id: 'sess-5', date: '2025-08-05' },
  ],
  total_time_found_ms: 9900,
};

const MOCK_EFFICACY: EfficacyOverview = {
  total_suggestions: 25,
  adoption_rate: 0.72,
  avg_delta_by_status: {
    applied: -850,
    applied_modified: -420,
    skipped: 120,
  },
};

const MOCK_SESSION_HISTORY: SessionHistory = {
  sessions: [
    { session_id: 'sess-1', event_id: 'evt-1', date: '2025-06-01', track_name: 'Barber Motorsports Park', session_type: 'practice', best_lap_ms: 102500, delta_from_previous_ms: null },
    { session_id: 'sess-2', event_id: 'evt-2', date: '2025-06-15', track_name: 'Barber Motorsports Park', session_type: 'qualifying', best_lap_ms: 101200, delta_from_previous_ms: -1300 },
    { session_id: 'sess-3', event_id: 'evt-3', date: '2025-07-01', track_name: 'Road Atlanta', session_type: 'practice', best_lap_ms: 95800, delta_from_previous_ms: null },
    { session_id: 'sess-4', event_id: 'evt-4', date: '2025-07-20', track_name: 'Barber Motorsports Park', session_type: 'race', best_lap_ms: 100100, delta_from_previous_ms: -1100 },
    { session_id: 'sess-5', event_id: 'evt-5', date: '2025-08-05', track_name: 'Road Atlanta', session_type: 'qualifying', best_lap_ms: 94200, delta_from_previous_ms: -1600 },
    { session_id: 'sess-6', event_id: 'evt-6', date: '2025-08-20', track_name: 'Barber Motorsports Park', session_type: 'trackday', best_lap_ms: 99400, delta_from_previous_ms: -700 },
    { session_id: 'sess-7', event_id: 'evt-7', date: '2025-09-10', track_name: 'Road Atlanta', session_type: 'race', best_lap_ms: 93800, delta_from_previous_ms: -400 },
    { session_id: 'sess-8', event_id: 'evt-8', date: '2025-09-25', track_name: 'Barber Motorsports Park', session_type: 'practice', best_lap_ms: 98900, delta_from_previous_ms: -500 },
  ],
};

export const progressHandlers = [
  http.get(`${BASE}/progress`, () => {
    return HttpResponse.json(MOCK_PROGRESS);
  }),

  http.get(`${BASE}/progress/efficacy`, () => {
    return HttpResponse.json(MOCK_EFFICACY);
  }),

  http.get(`${BASE}/progress/sessions`, () => {
    return HttpResponse.json(MOCK_SESSION_HISTORY);
  }),
];

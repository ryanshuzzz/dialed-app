import { http, HttpResponse } from 'msw';
import type { ChannelSummary, LapData, SessionAnalysis, TelemetryPoint } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_CHANNELS: ChannelSummary = {
  channels: [
    { name: 'gps_speed', min: 0, max: 285, sample_count: 12000 },
    { name: 'throttle_pos', min: 0, max: 100, sample_count: 12000 },
    { name: 'rpm', min: 2000, max: 14500, sample_count: 12000 },
    { name: 'gear', min: 1, max: 6, sample_count: 12000 },
    { name: 'lean_angle', min: -58, max: 57, sample_count: 12000 },
    { name: 'front_brake_psi', min: 0, max: 1200, sample_count: 12000 },
    { name: 'rear_brake_psi', min: 0, max: 400, sample_count: 12000 },
    { name: 'fork_position', min: 0, max: 120, sample_count: 12000 },
  ],
  total_samples: 96000,
  time_range: {
    start: '2025-09-12T09:00:00Z',
    end: '2025-09-12T09:05:00Z',
  },
};

function generateLapPoints(sessionId: string, lapNumber: number): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  for (let i = 0; i < 200; i++) {
    const t = i / 200;
    points.push({
      time: new Date(Date.parse('2025-09-12T09:00:00Z') + i * 250).toISOString(),
      session_id: sessionId,
      gps_speed: Math.round(80 + 150 * Math.sin(t * Math.PI * 4) * (0.5 + 0.5 * Math.random())),
      throttle_pos: Math.round(Math.max(0, Math.min(100, 50 + 50 * Math.sin(t * Math.PI * 6)))),
      rpm: Math.round(5000 + 8000 * Math.abs(Math.sin(t * Math.PI * 4))),
      gear: Math.min(6, Math.max(1, Math.round(1 + 5 * t * (1 + Math.sin(t * Math.PI * 3))))),
      lean_angle: Math.round(45 * Math.sin(t * Math.PI * 8)),
      front_brake_psi: Math.round(Math.max(0, 800 * Math.max(0, -Math.sin(t * Math.PI * 6)))),
      rear_brake_psi: Math.round(Math.max(0, 300 * Math.max(0, -Math.sin(t * Math.PI * 6)))),
      fork_position: Math.round(30 + 60 * Math.abs(Math.sin(t * Math.PI * 4))),
      coolant_temp: null,
      oil_temp: null,
      lat: null,
      lon: null,
      extra_channels: {},
      shock_position: null,
    });
  }
  // Use lapNumber to avoid unused param warning
  if (lapNumber > 0) {
    points[0].time = new Date(
      Date.parse('2025-09-12T09:00:00Z') + (lapNumber - 1) * 50000,
    ).toISOString();
  }
  return points;
}

const MOCK_ANALYSIS: SessionAnalysis = {
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
    {
      id: 'seg-2',
      session_id: 'session-1',
      lap_number: 2,
      start_time_ms: 98432,
      end_time_ms: 196200,
      lap_time_ms: 97768,
      beacon_start_s: null,
      beacon_end_s: null,
      created_at: '2025-09-12T09:00:00Z',
    },
    {
      id: 'seg-3',
      session_id: 'session-1',
      lap_number: 3,
      start_time_ms: 196200,
      end_time_ms: 294050,
      lap_time_ms: 97850,
      beacon_start_s: null,
      beacon_end_s: null,
      created_at: '2025-09-12T09:00:00Z',
    },
  ],
  best_lap: { lap_number: 2, lap_time_ms: 97768 },
  braking_zones: [
    { zone_id: 1, entry_speed_kph: 245, exit_speed_kph: 85, max_brake_psi: 1100, duration_ms: 2800 },
    { zone_id: 2, entry_speed_kph: 200, exit_speed_kph: 120, max_brake_psi: 900, duration_ms: 1800 },
    { zone_id: 3, entry_speed_kph: 180, exit_speed_kph: 95, max_brake_psi: 1050, duration_ms: 2200 },
  ],
  fork_rebound: { avg_rebound_rate: 42.5, max_compression_mm: 112 },
  tcs_events: [],
};

export const telemetryHandlers = [
  // POST /api/v1/telemetry/upload
  http.post(`${BASE}/telemetry/upload`, () => {
    return HttpResponse.json({ inserted_count: 1200 }, { status: 201 });
  }),

  // GET /api/v1/telemetry/:session_id/channels
  http.get(`${BASE}/telemetry/:session_id/channels`, () => {
    return HttpResponse.json(MOCK_CHANNELS);
  }),

  // GET /api/v1/telemetry/:session_id/lap/:n
  http.get(`${BASE}/telemetry/:session_id/lap/:n`, ({ params }) => {
    const sessionId = params.session_id as string;
    const lapNumber = parseInt(params.n as string, 10);
    const lapData: LapData = {
      session_id: sessionId,
      lap_number: lapNumber,
      lap_time_ms: 97850 + lapNumber * 100,
      sample_rate_hz: 20,
      points: generateLapPoints(sessionId, lapNumber),
    };
    return HttpResponse.json(lapData);
  }),

  // GET /api/v1/telemetry/:session_id/analysis
  http.get(`${BASE}/telemetry/:session_id/analysis`, () => {
    return HttpResponse.json(MOCK_ANALYSIS);
  }),
];

import { http, HttpResponse } from 'msw';
import type {
  Session,
  SessionDetail,
  CreateSessionRequest,
  SetupSnapshot,
  ChangeLog,
  CreateChangeRequest,
  CreateSnapshotRequest,
} from '@/api/types';

const BASE = '*/api/v1';

const MOCK_SESSIONS: Session[] = [
  {
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
  },
  {
    id: 'session-2',
    event_id: 'event-1',
    user_id: 'user-1',
    session_type: 'qualifying',
    manual_best_lap_ms: 96800,
    csv_best_lap_ms: 96420,
    tire_front: { brand: 'Pirelli', compound: 'SC1', laps: 12 },
    tire_rear: { brand: 'Pirelli', compound: 'SC0', laps: 12 },
    rider_feedback: 'Much better rear grip with SC0. Pushed hard in sector 3.',
    voice_note_url: null,
    created_at: '2025-09-12T13:00:00Z',
    updated_at: '2025-09-12T14:30:00Z',
  },
  {
    id: 'session-3',
    event_id: 'event-2',
    user_id: 'user-1',
    session_type: 'trackday',
    manual_best_lap_ms: 105200,
    csv_best_lap_ms: null,
    tire_front: { brand: 'Dunlop', compound: 'Q4', laps: 80 },
    tire_rear: { brand: 'Dunlop', compound: 'Q4', laps: 80 },
    rider_feedback: 'Damp conditions in morning. Took it easy.',
    voice_note_url: null,
    created_at: '2025-10-05T08:00:00Z',
    updated_at: '2025-10-05T16:00:00Z',
  },
  {
    id: 'session-4',
    event_id: 'event-3',
    user_id: 'user-1',
    session_type: 'race',
    manual_best_lap_ms: 95100,
    csv_best_lap_ms: 94980,
    tire_front: { brand: 'Pirelli', compound: 'SC1', laps: 22 },
    tire_rear: { brand: 'Pirelli', compound: 'SC1', laps: 22 },
    rider_feedback: 'Great race. P2 finish. Struggled with braking into T1.',
    voice_note_url: null,
    created_at: '2025-11-20T14:00:00Z',
    updated_at: '2025-11-20T15:30:00Z',
  },
  {
    id: 'session-5',
    event_id: 'event-4',
    user_id: 'user-1',
    session_type: 'practice',
    manual_best_lap_ms: 102000,
    csv_best_lap_ms: null,
    tire_front: { brand: 'Michelin', compound: 'Power Cup 2', laps: 60 },
    tire_rear: { brand: 'Michelin', compound: 'Power Cup 2', laps: 60 },
    rider_feedback: 'Wet session. Working on rain lines.',
    voice_note_url: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'session-road-1',
    event_id: 'event-road-1',
    user_id: 'user-1',
    session_type: 'commute',
    manual_best_lap_ms: null,
    csv_best_lap_ms: null,
    tire_front: null,
    tire_rear: null,
    rider_feedback: 'Smooth run, lane-splitting where legal.',
    voice_note_url: null,
    ride_metrics: {
      distance_km: 42.5,
      duration_ms: 45 * 60 * 1000,
      fuel_used_l: 2.1,
      odometer_km: 12500,
      fuel_efficiency_l_per_100km: 4.9,
    },
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-02-01T09:00:00Z',
  },
];

const MOCK_SNAPSHOTS: Record<string, SetupSnapshot[]> = {
  'session-1': [
    {
      id: 'snap-1',
      session_id: 'session-1',
      settings: {
        schema_version: 1,
        front: { compression: 12, rebound: 14, preload: 8, spring_rate: 0.95 },
        rear: { compression: 10, rebound: 12, preload: 6, spring_rate: 95 },
      },
      created_at: '2025-09-12T09:00:00Z',
    },
  ],
};

const MOCK_CHANGES: Record<string, ChangeLog[]> = {
  'session-1': [
    {
      id: 'change-1',
      session_id: 'session-1',
      parameter: 'rear_rebound',
      from_value: '12',
      to_value: '14',
      rationale: 'Rear was kicking on exit. Slowing rebound to settle the rear.',
      applied_at: '2025-09-12T10:30:00Z',
    },
    {
      id: 'change-2',
      session_id: 'session-1',
      parameter: 'front_compression',
      from_value: '12',
      to_value: '10',
      rationale: 'Softening front to improve trail braking feel.',
      applied_at: '2025-09-12T11:00:00Z',
    },
    {
      id: 'change-3',
      session_id: 'session-1',
      parameter: 'rear_preload',
      from_value: '6',
      to_value: '7',
      rationale: 'Raising rear slightly to shift weight forward.',
      applied_at: '2025-09-12T11:30:00Z',
    },
  ],
};

/** Mutable store so POST /sessions + PATCH + change log match GET detail (MSW dev flow). */
const sessionsState: Session[] = MOCK_SESSIONS.map((s) => ({ ...s }));
const snapshotsState: Record<string, SetupSnapshot[]> = Object.fromEntries(
  Object.entries(MOCK_SNAPSHOTS).map(([k, v]) => [k, v.map((x) => ({ ...x, settings: { ...x.settings } }))]),
);
const changesState: Record<string, ChangeLog[]> = Object.fromEntries(
  Object.entries(MOCK_CHANGES).map(([k, v]) => [k, [...v]]),
);

function ensureSessionChildren(sessionId: string): void {
  if (!snapshotsState[sessionId]) snapshotsState[sessionId] = [];
  if (!changesState[sessionId]) changesState[sessionId] = [];
}

function getSessionDetail(id: string): SessionDetail | undefined {
  const session = sessionsState.find((s) => s.id === id);
  if (!session) return undefined;
  ensureSessionChildren(id);
  return {
    ...session,
    snapshots: snapshotsState[id] ?? [],
    changes: changesState[id] ?? [],
  };
}

export const sessionHandlers = [
  // GET /api/v1/sessions
  http.get(`${BASE}/sessions`, () => {
    return HttpResponse.json(sessionsState);
  }),

  // POST /api/v1/sessions
  http.post(`${BASE}/sessions`, async ({ request }) => {
    const body = (await request.json()) as CreateSessionRequest;
    const newSession: Session = {
      id: `session-${Date.now()}`,
      event_id: body.event_id,
      user_id: 'user-1',
      session_type: body.session_type,
      manual_best_lap_ms: body.manual_best_lap_ms ?? null,
      csv_best_lap_ms: null,
      tire_front: body.tire_front ?? null,
      tire_rear: body.tire_rear ?? null,
      rider_feedback: body.rider_feedback ?? null,
      voice_note_url: body.voice_note_url ?? null,
      ride_metrics: body.ride_metrics ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sessionsState.push(newSession);
    ensureSessionChildren(newSession.id);
    return HttpResponse.json(newSession, { status: 201 });
  }),

  // GET /api/v1/sessions/:id
  http.get(`${BASE}/sessions/:id`, ({ params }) => {
    const detail = getSessionDetail(params.id as string);
    if (!detail) {
      return HttpResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(detail);
  }),

  // PATCH /api/v1/sessions/:id
  http.patch(`${BASE}/sessions/:id`, async ({ params, request }) => {
    const id = params.id as string;
    const idx = sessionsState.findIndex((s) => s.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const updated: Session = {
      ...sessionsState[idx],
      ...body,
      updated_at: new Date().toISOString(),
    } as Session;
    sessionsState[idx] = updated;
    return HttpResponse.json(updated);
  }),

  // POST /api/v1/sessions/:id/snapshot
  http.post(`${BASE}/sessions/:id/snapshot`, async ({ params, request }) => {
    const id = params.id as string;
    if (!sessionsState.some((s) => s.id === id)) {
      return HttpResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as CreateSnapshotRequest;
    const snapshot: SetupSnapshot = {
      id: `snap-${Date.now()}`,
      session_id: id,
      settings: body.settings,
      created_at: new Date().toISOString(),
    };
    ensureSessionChildren(id);
    snapshotsState[id].push(snapshot);
    return HttpResponse.json(snapshot, { status: 201 });
  }),

  // POST /api/v1/sessions/:id/changes
  http.post(`${BASE}/sessions/:id/changes`, async ({ params, request }) => {
    const id = params.id as string;
    if (!sessionsState.some((s) => s.id === id)) {
      return HttpResponse.json(
        { error: 'Session not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as CreateChangeRequest;
    const change: ChangeLog = {
      id: `change-${Date.now()}`,
      session_id: id,
      parameter: body.parameter,
      from_value: body.from_value ?? null,
      to_value: body.to_value,
      rationale: body.rationale ?? null,
      applied_at: body.applied_at ?? new Date().toISOString(),
    };
    ensureSessionChildren(id);
    changesState[id].push(change);
    return HttpResponse.json(change, { status: 201 });
  }),

  // GET /api/v1/sessions/:id/changes
  http.get(`${BASE}/sessions/:id/changes`, ({ params }) => {
    const id = params.id as string;
    ensureSessionChildren(id);
    return HttpResponse.json(changesState[id] ?? []);
  }),
];

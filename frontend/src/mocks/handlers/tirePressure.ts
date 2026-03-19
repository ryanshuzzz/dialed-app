import { http, HttpResponse } from 'msw';
import type { TirePressureLog, CreateTirePressureRequest } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_TIRE_PRESSURE: TirePressureLog[] = [
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
    notes: 'Morning check before ride',
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
  {
    id: 'tp-3',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 36.0,
    rear_psi: 33.5,
    front_temp_c: 65,
    rear_temp_c: 70,
    context: 'post_session',
    session_id: 'session-1',
    notes: 'Pressures rose as expected',
    recorded_at: '2026-01-20T11:30:00Z',
    created_at: '2026-01-20T11:30:00Z',
  },
  {
    id: 'tp-4',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 33.0,
    rear_psi: 30.5,
    front_temp_c: 30,
    rear_temp_c: 30,
    context: 'pre_ride',
    session_id: null,
    notes: null,
    recorded_at: '2026-02-05T09:00:00Z',
    created_at: '2026-02-05T09:00:00Z',
  },
  {
    id: 'tp-5',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 35.5,
    rear_psi: 33.0,
    front_temp_c: 55,
    rear_temp_c: 60,
    context: 'pit_stop',
    session_id: null,
    notes: 'Mid-ride check at gas stop',
    recorded_at: '2026-02-05T12:00:00Z',
    created_at: '2026-02-05T12:00:00Z',
  },
  {
    id: 'tp-6',
    bike_id: 'bike-1',
    user_id: 'user-1',
    front_psi: 34.0,
    rear_psi: 32.0,
    front_temp_c: 40,
    rear_temp_c: 42,
    context: 'post_ride',
    session_id: null,
    notes: null,
    recorded_at: '2026-02-05T16:00:00Z',
    created_at: '2026-02-05T16:00:00Z',
  },
];

export const tirePressureHandlers = [
  // GET /api/v1/garage/bikes/:id/tire-pressure
  http.get(`${BASE}/garage/bikes/:id/tire-pressure`, ({ params }) => {
    const bikeId = params.id as string;
    const entries = MOCK_TIRE_PRESSURE.filter((tp) => tp.bike_id === bikeId);
    return HttpResponse.json(entries);
  }),

  // POST /api/v1/garage/bikes/:id/tire-pressure
  http.post(`${BASE}/garage/bikes/:id/tire-pressure`, async ({ params, request }) => {
    const body = (await request.json()) as CreateTirePressureRequest;
    const newEntry: TirePressureLog = {
      id: `tp-${Date.now()}`,
      bike_id: params.id as string,
      user_id: 'user-1',
      front_psi: body.front_psi ?? null,
      rear_psi: body.rear_psi ?? null,
      front_temp_c: body.front_temp_c ?? null,
      rear_temp_c: body.rear_temp_c ?? null,
      context: body.context ?? 'cold',
      session_id: body.session_id ?? null,
      notes: body.notes ?? null,
      recorded_at: body.recorded_at ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(newEntry, { status: 201 });
  }),

  // GET /api/v1/garage/bikes/:id/tire-pressure/:rid
  http.get(`${BASE}/garage/bikes/:id/tire-pressure/:rid`, ({ params }) => {
    const entry = MOCK_TIRE_PRESSURE.find((tp) => tp.id === (params.rid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Tire pressure reading not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(entry);
  }),

  // DELETE /api/v1/garage/bikes/:id/tire-pressure/:rid
  http.delete(`${BASE}/garage/bikes/:id/tire-pressure/:rid`, ({ params }) => {
    const entry = MOCK_TIRE_PRESSURE.find((tp) => tp.id === (params.rid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Tire pressure reading not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

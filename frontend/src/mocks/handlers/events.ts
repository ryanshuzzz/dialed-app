import { http, HttpResponse } from 'msw';
import type { TrackEvent, CreateEventRequest } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_EVENTS: TrackEvent[] = [
  {
    id: 'event-1',
    user_id: 'user-1',
    bike_id: 'bike-1',
    track_id: 'track-1',
    date: '2025-09-12',
    conditions: {
      temp_c: 28,
      humidity_pct: 45,
      track_temp_c: 42,
      wind_kph: 8,
      condition: 'dry',
      notes: 'Perfect track conditions.',
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
      humidity_pct: 72,
      track_temp_c: 22,
      wind_kph: 25,
      condition: 'damp',
      notes: 'Morning fog cleared by session 2.',
    },
    created_at: '2025-10-03T10:00:00Z',
    updated_at: '2025-10-05T16:00:00Z',
  },
  {
    id: 'event-3',
    user_id: 'user-1',
    bike_id: 'bike-1',
    track_id: 'track-3',
    date: '2025-11-20',
    conditions: {
      temp_c: 32,
      humidity_pct: 55,
      track_temp_c: 48,
      wind_kph: 5,
      condition: 'dry',
      notes: null,
    },
    created_at: '2025-11-18T09:00:00Z',
    updated_at: '2025-11-20T17:00:00Z',
  },
  {
    id: 'event-4',
    user_id: 'user-1',
    bike_id: 'bike-2',
    track_id: 'track-1',
    date: '2026-01-15',
    conditions: {
      temp_c: 12,
      humidity_pct: 80,
      track_temp_c: 14,
      wind_kph: 15,
      condition: 'wet',
      notes: 'Rain throughout the day.',
    },
    created_at: '2026-01-13T11:00:00Z',
    updated_at: '2026-01-15T15:00:00Z',
  },
];

export const eventHandlers = [
  // GET /api/v1/garage/events
  http.get(`${BASE}/garage/events`, ({ request }) => {
    const url = new URL(request.url);
    const bikeId = url.searchParams.get('bike_id');
    const trackId = url.searchParams.get('track_id');
    const fromDate = url.searchParams.get('from_date');
    const toDate = url.searchParams.get('to_date');

    let filtered = [...MOCK_EVENTS];
    if (bikeId) filtered = filtered.filter((e) => e.bike_id === bikeId);
    if (trackId) filtered = filtered.filter((e) => e.track_id === trackId);
    if (fromDate) filtered = filtered.filter((e) => e.date >= fromDate);
    if (toDate) filtered = filtered.filter((e) => e.date <= toDate);

    return HttpResponse.json(filtered);
  }),

  // POST /api/v1/garage/events
  http.post(`${BASE}/garage/events`, async ({ request }) => {
    const body = (await request.json()) as CreateEventRequest;
    const newEvent: TrackEvent = {
      id: `event-${Date.now()}`,
      user_id: 'user-1',
      bike_id: body.bike_id,
      track_id: body.track_id,
      date: body.date,
      conditions: body.conditions ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(newEvent, { status: 201 });
  }),

  // GET /api/v1/garage/events/:id
  http.get(`${BASE}/garage/events/:id`, ({ params }) => {
    const event = MOCK_EVENTS.find((e) => e.id === params.id);
    if (!event) {
      return HttpResponse.json(
        { error: 'Event not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(event);
  }),

  // PATCH /api/v1/garage/events/:id
  http.patch(`${BASE}/garage/events/:id`, async ({ params, request }) => {
    const event = MOCK_EVENTS.find((e) => e.id === params.id);
    if (!event) {
      return HttpResponse.json(
        { error: 'Event not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const updated: TrackEvent = {
      ...event,
      ...body,
      updated_at: new Date().toISOString(),
    } as TrackEvent;
    return HttpResponse.json(updated);
  }),

  // DELETE /api/v1/garage/events/:id
  http.delete(`${BASE}/garage/events/:id`, ({ params }) => {
    const event = MOCK_EVENTS.find((e) => e.id === params.id);
    if (!event) {
      return HttpResponse.json(
        { error: 'Event not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

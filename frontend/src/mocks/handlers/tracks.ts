import { http, HttpResponse } from 'msw';
import type { Track, CreateTrackRequest } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_TRACKS: Track[] = [
  {
    id: 'track-1',
    name: 'Mugello',
    config: 'Full Circuit',
    surface_notes: 'Smooth asphalt, high grip. Repaved 2023.',
    gps_bounds: null,
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2025-06-15T10:00:00Z',
  },
  {
    id: 'track-2',
    name: 'Phillip Island',
    config: 'Grand Prix Circuit',
    surface_notes: 'Exposed to wind. Surface can be slippery when damp.',
    gps_bounds: null,
    created_at: '2024-02-20T12:00:00Z',
    updated_at: '2025-08-10T14:00:00Z',
  },
  {
    id: 'track-3',
    name: 'COTA',
    config: 'Full Course',
    surface_notes: 'Bumpy in sectors 2-3. Repave pending.',
    gps_bounds: null,
    created_at: '2024-04-05T09:00:00Z',
    updated_at: '2025-09-01T11:00:00Z',
  },
];

export const trackHandlers = [
  // GET /api/v1/garage/tracks
  http.get(`${BASE}/garage/tracks`, () => {
    return HttpResponse.json(MOCK_TRACKS);
  }),

  // POST /api/v1/garage/tracks
  http.post(`${BASE}/garage/tracks`, async ({ request }) => {
    const body = (await request.json()) as CreateTrackRequest;
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: body.name,
      config: body.config ?? null,
      surface_notes: body.surface_notes ?? null,
      gps_bounds: body.gps_bounds ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(newTrack, { status: 201 });
  }),

  // GET /api/v1/garage/tracks/:id
  http.get(`${BASE}/garage/tracks/:id`, ({ params }) => {
    const track = MOCK_TRACKS.find((t) => t.id === params.id);
    if (!track) {
      return HttpResponse.json(
        { error: 'Track not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(track);
  }),

  // PATCH /api/v1/garage/tracks/:id
  http.patch(`${BASE}/garage/tracks/:id`, async ({ params, request }) => {
    const track = MOCK_TRACKS.find((t) => t.id === params.id);
    if (!track) {
      return HttpResponse.json(
        { error: 'Track not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const updated: Track = {
      ...track,
      ...body,
      updated_at: new Date().toISOString(),
    } as Track;
    return HttpResponse.json(updated);
  }),

  // DELETE /api/v1/garage/tracks/:id
  http.delete(`${BASE}/garage/tracks/:id`, ({ params }) => {
    const track = MOCK_TRACKS.find((t) => t.id === params.id);
    if (!track) {
      return HttpResponse.json(
        { error: 'Track not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

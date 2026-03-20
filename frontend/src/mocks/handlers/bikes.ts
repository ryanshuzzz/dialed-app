import { http, HttpResponse } from 'msw';
import type { Bike, BikeDetail, CreateBikeRequest } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_BIKES: Bike[] = [
  {
    id: 'bike-1',
    user_id: 'user-1',
    make: 'Ducati',
    model: 'Panigale V4 R',
    year: 2024,
    vin: 'ZDM14BKW0RB000123',
    color: 'Red',
    mileage_km: 4200,
    engine_hours: 82,
    exhaust: 'Akrapovic Full System',
    ecu: 'Ducati Performance',
    gearing_front: 16,
    gearing_rear: 42,
    suspension_spec: {
      schema_version: 1,
      front: {
        compression: 12,
        rebound: 14,
        preload: 8,
        spring_rate: 0.95,
        oil_level: 120,
        ride_height: null,
      },
      rear: {
        compression: 10,
        rebound: 12,
        preload: 6,
        spring_rate: 95,
        oil_level: null,
        ride_height: 5,
      },
    },
    notes: 'Track-prepped. Rearsets swapped to Woodcraft GP.',
    status: 'owned',
    deleted_at: null,
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2025-12-20T08:30:00Z',
  },
  {
    id: 'bike-2',
    user_id: 'user-1',
    make: 'Yamaha',
    model: 'YZF-R1',
    year: 2023,
    vin: null,
    color: 'Blue',
    mileage_km: 11200,
    engine_hours: null,
    exhaust: 'Graves Motorsports',
    ecu: null,
    gearing_front: 16,
    gearing_rear: 45,
    suspension_spec: {
      schema_version: 1,
      front: {
        compression: 8,
        rebound: 10,
        preload: 5,
      },
      rear: {
        compression: 6,
        rebound: 8,
        preload: 4,
      },
    },
    notes: null,
    status: 'owned',
    deleted_at: null,
    created_at: '2023-06-01T12:00:00Z',
    updated_at: '2025-11-10T14:00:00Z',
  },
];

const MOCK_BIKE_DETAILS: Record<string, BikeDetail> = {
  'bike-1': {
    ...MOCK_BIKES[0],
    stats: {
      maintenance_count: 12,
      modification_count: 8,
      session_count: 24,
      best_lap_ms: 98432,
    },
  },
  'bike-2': {
    ...MOCK_BIKES[1],
    stats: {
      maintenance_count: 5,
      modification_count: 3,
      session_count: 6,
      best_lap_ms: 105200,
    },
  },
};

export const bikeHandlers = [
  // GET /api/v1/garage/bikes
  http.get(`${BASE}/garage/bikes`, () => {
    return HttpResponse.json(MOCK_BIKES);
  }),

  // POST /api/v1/garage/bikes
  http.post(`${BASE}/garage/bikes`, async ({ request }) => {
    const body = (await request.json()) as CreateBikeRequest;
    const newBike: Bike = {
      id: `bike-${Date.now()}`,
      user_id: 'user-1',
      make: body.make,
      model: body.model,
      year: body.year ?? null,
      vin: body.vin ?? null,
      color: body.color ?? null,
      mileage_km: body.mileage_km ?? null,
      engine_hours: body.engine_hours ?? null,
      exhaust: body.exhaust ?? null,
      ecu: body.ecu ?? null,
      gearing_front: body.gearing_front ?? null,
      gearing_rear: body.gearing_rear ?? null,
      suspension_spec: body.suspension_spec ?? { schema_version: 1 },
      notes: body.notes ?? null,
      status: body.status ?? 'owned',
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_BIKES.push(newBike);
    MOCK_BIKE_DETAILS[newBike.id] = {
      ...newBike,
      stats: {
        maintenance_count: 0,
        modification_count: 0,
        session_count: 0,
        best_lap_ms: null,
      },
    };
    return HttpResponse.json(newBike, { status: 201 });
  }),

  // GET /api/v1/garage/bikes/:id
  http.get(`${BASE}/garage/bikes/:id`, ({ params }) => {
    const detail = MOCK_BIKE_DETAILS[params.id as string];
    if (!detail) {
      return HttpResponse.json(
        { error: 'Bike not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(detail);
  }),

  // PATCH /api/v1/garage/bikes/:id
  http.patch(`${BASE}/garage/bikes/:id`, async ({ params, request }) => {
    const detail = MOCK_BIKE_DETAILS[params.id as string];
    if (!detail) {
      return HttpResponse.json(
        { error: 'Bike not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Record<string, unknown>;
    const updated: Bike = {
      ...detail,
      ...body,
      updated_at: new Date().toISOString(),
    } as Bike;
    return HttpResponse.json(updated);
  }),

  // DELETE /api/v1/garage/bikes/:id
  http.delete(`${BASE}/garage/bikes/:id`, ({ params }) => {
    const detail = MOCK_BIKE_DETAILS[params.id as string];
    if (!detail) {
      return HttpResponse.json(
        { error: 'Bike not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

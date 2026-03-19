import { http, HttpResponse } from 'msw';
import type { OwnershipHistory, CreateOwnershipRequest } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_OWNERSHIP: OwnershipHistory[] = [
  {
    id: 'own-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    event_type: 'purchased',
    date: '2024-03-15',
    price: 28500,
    currency: '$',
    mileage_km: 0,
    counterparty: 'Ducati Dealer - Bay Area Motorsports',
    notes: 'Brand new, purchased at MSRP',
    created_at: '2024-03-15T10:00:00Z',
  },
  {
    id: 'own-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    event_type: 'traded',
    date: '2025-08-20',
    price: 5000,
    currency: '$',
    mileage_km: 3200,
    counterparty: 'Track buddy - Mike',
    notes: 'Traded OEM exhaust + cash for Akrapovic system',
    created_at: '2025-08-20T10:00:00Z',
  },
];

export const ownershipHandlers = [
  // GET /api/v1/garage/bikes/:id/ownership
  http.get(`${BASE}/garage/bikes/:id/ownership`, ({ params }) => {
    const bikeId = params.id as string;
    const entries = MOCK_OWNERSHIP.filter((o) => o.bike_id === bikeId);
    return HttpResponse.json(entries);
  }),

  // POST /api/v1/garage/bikes/:id/ownership
  http.post(`${BASE}/garage/bikes/:id/ownership`, async ({ params, request }) => {
    const body = (await request.json()) as CreateOwnershipRequest;
    const newEntry: OwnershipHistory = {
      id: `own-${Date.now()}`,
      bike_id: params.id as string,
      user_id: 'user-1',
      event_type: body.event_type,
      date: body.date,
      price: body.price ?? null,
      currency: body.currency ?? null,
      mileage_km: body.mileage_km ?? null,
      counterparty: body.counterparty ?? null,
      notes: body.notes ?? null,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(newEntry, { status: 201 });
  }),

  // DELETE /api/v1/garage/bikes/:id/ownership/:oid
  http.delete(`${BASE}/garage/bikes/:id/ownership/:oid`, ({ params }) => {
    const entry = MOCK_OWNERSHIP.find((o) => o.id === (params.oid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Ownership event not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

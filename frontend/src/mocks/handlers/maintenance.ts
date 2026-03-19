import { http, HttpResponse } from 'msw';
import type {
  MaintenanceLog,
  CreateMaintenanceRequest,
  UpdateMaintenanceRequest,
  UpcomingMaintenance,
} from '@/api/types';

const BASE = '*/api/v1';

const MOCK_MAINTENANCE: MaintenanceLog[] = [
  {
    id: 'maint-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'oil_change',
    description: 'Full synthetic oil change with Motul 300V',
    mileage_km: 4000,
    engine_hours: 78,
    cost: 85.0,
    currency: '$',
    performed_by: 'Self',
    performed_at: '2025-12-01T10:00:00Z',
    next_due_km: 7000,
    next_due_date: '2026-06-01T00:00:00Z',
    notes: 'Used OEM filter',
    receipt_url: null,
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2025-12-01T10:00:00Z',
  },
  {
    id: 'maint-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'chain',
    description: 'Chain cleaned, lubed, and tension adjusted',
    mileage_km: 3800,
    engine_hours: null,
    cost: 15.0,
    currency: '$',
    performed_by: 'Self',
    performed_at: '2025-11-15T14:00:00Z',
    next_due_km: 4300,
    next_due_date: null,
    notes: null,
    receipt_url: null,
    created_at: '2025-11-15T14:00:00Z',
    updated_at: '2025-11-15T14:00:00Z',
  },
  {
    id: 'maint-3',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'brakes',
    description: 'Front brake pads replaced with EBC HH sintered',
    mileage_km: 3500,
    engine_hours: null,
    cost: 65.0,
    currency: '$',
    performed_by: 'Track Day Garage',
    performed_at: '2025-10-20T09:00:00Z',
    next_due_km: 8000,
    next_due_date: null,
    notes: 'Rear pads still have 40% life',
    receipt_url: null,
    created_at: '2025-10-20T09:00:00Z',
    updated_at: '2025-10-20T09:00:00Z',
  },
  {
    id: 'maint-4',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'coolant',
    description: 'Coolant flush and refill with Engine Ice',
    mileage_km: 3000,
    engine_hours: 60,
    cost: 45.0,
    currency: '$',
    performed_by: 'Self',
    performed_at: '2025-09-10T11:00:00Z',
    next_due_km: 9000,
    next_due_date: '2026-09-10T00:00:00Z',
    notes: null,
    receipt_url: null,
    created_at: '2025-09-10T11:00:00Z',
    updated_at: '2025-09-10T11:00:00Z',
  },
  {
    id: 'maint-5',
    bike_id: 'bike-1',
    user_id: 'user-1',
    category: 'valve_check',
    description: 'Valve clearance check - all within spec',
    mileage_km: 2500,
    engine_hours: 50,
    cost: 250.0,
    currency: '$',
    performed_by: 'Ducati Dealer',
    performed_at: '2025-08-01T08:00:00Z',
    next_due_km: 12500,
    next_due_date: null,
    notes: 'Intake: 0.15mm, Exhaust: 0.20mm - all nominal',
    receipt_url: null,
    created_at: '2025-08-01T08:00:00Z',
    updated_at: '2025-08-01T08:00:00Z',
  },
];

const MOCK_UPCOMING: UpcomingMaintenance = {
  items: [
    {
      id: 'maint-2',
      bike_id: 'bike-1',
      category: 'chain',
      performed_at: '2025-11-15T14:00:00Z',
      next_due_km: 4300,
      next_due_date: null,
      current_mileage_km: 4200,
    },
    {
      id: 'maint-1',
      bike_id: 'bike-1',
      category: 'oil_change',
      performed_at: '2025-12-01T10:00:00Z',
      next_due_km: 7000,
      next_due_date: '2026-06-01T00:00:00Z',
      current_mileage_km: 4200,
    },
  ],
};

export const maintenanceHandlers = [
  // GET /api/v1/garage/bikes/:id/maintenance
  http.get(`${BASE}/garage/bikes/:id/maintenance`, ({ request, params }) => {
    const url = new URL(request.url);
    const categoryFilter = url.searchParams.get('category');
    const bikeId = params.id as string;

    let entries = MOCK_MAINTENANCE.filter((m) => m.bike_id === bikeId);
    if (categoryFilter) {
      entries = entries.filter((m) => m.category === categoryFilter);
    }
    return HttpResponse.json(entries);
  }),

  // GET /api/v1/garage/bikes/:id/maintenance/upcoming
  http.get(`${BASE}/garage/bikes/:id/maintenance/upcoming`, () => {
    return HttpResponse.json(MOCK_UPCOMING);
  }),

  // GET /api/v1/garage/bikes/:id/maintenance/:mid
  http.get(`${BASE}/garage/bikes/:id/maintenance/:mid`, ({ params }) => {
    const entry = MOCK_MAINTENANCE.find((m) => m.id === (params.mid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Maintenance entry not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(entry);
  }),

  // POST /api/v1/garage/bikes/:id/maintenance
  http.post(`${BASE}/garage/bikes/:id/maintenance`, async ({ params, request }) => {
    const body = (await request.json()) as CreateMaintenanceRequest;
    const newEntry: MaintenanceLog = {
      id: `maint-${Date.now()}`,
      bike_id: params.id as string,
      user_id: 'user-1',
      category: body.category,
      description: body.description ?? null,
      mileage_km: body.mileage_km ?? null,
      engine_hours: body.engine_hours ?? null,
      cost: body.cost ?? null,
      currency: body.currency ?? null,
      performed_by: body.performed_by ?? null,
      performed_at: body.performed_at,
      next_due_km: body.next_due_km ?? null,
      next_due_date: body.next_due_date ?? null,
      notes: body.notes ?? null,
      receipt_url: body.receipt_url ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(newEntry, { status: 201 });
  }),

  // PATCH /api/v1/garage/bikes/:id/maintenance/:mid
  http.patch(`${BASE}/garage/bikes/:id/maintenance/:mid`, async ({ params, request }) => {
    const entry = MOCK_MAINTENANCE.find((m) => m.id === (params.mid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Maintenance entry not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as UpdateMaintenanceRequest;
    const updated: MaintenanceLog = {
      ...entry,
      ...body,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(updated);
  }),

  // DELETE /api/v1/garage/bikes/:id/maintenance/:mid
  http.delete(`${BASE}/garage/bikes/:id/maintenance/:mid`, ({ params }) => {
    const entry = MOCK_MAINTENANCE.find((m) => m.id === (params.mid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Maintenance entry not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

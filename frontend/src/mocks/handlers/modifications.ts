import { http, HttpResponse } from 'msw';
import type {
  Modification,
  CreateModificationRequest,
  UpdateModificationRequest,
} from '@/api/types';

const BASE = '*/api/v1';

const MOCK_MODIFICATIONS: Modification[] = [
  {
    id: 'mod-1',
    bike_id: 'bike-1',
    user_id: 'user-1',
    action: 'installed',
    category: 'exhaust',
    part_name: 'Full System Exhaust',
    brand: 'Akrapovic',
    part_number: 'S-D10E9-RC',
    cost: 2850.0,
    currency: '$',
    installed_at: '2025-06-15T00:00:00Z',
    removed_at: null,
    mileage_km: 1200,
    notes: 'Titanium full system with carbon end cap',
    created_at: '2025-06-15T10:00:00Z',
    updated_at: '2025-06-15T10:00:00Z',
  },
  {
    id: 'mod-2',
    bike_id: 'bike-1',
    user_id: 'user-1',
    action: 'installed',
    category: 'suspension',
    part_name: 'Fork Cartridge Kit',
    brand: 'Ohlins',
    part_number: 'FKA-123',
    cost: 1650.0,
    currency: '$',
    installed_at: '2025-07-20T00:00:00Z',
    removed_at: null,
    mileage_km: 1800,
    notes: 'NIX30 cartridge kit for Showa BPF',
    created_at: '2025-07-20T10:00:00Z',
    updated_at: '2025-07-20T10:00:00Z',
  },
  {
    id: 'mod-3',
    bike_id: 'bike-1',
    user_id: 'user-1',
    action: 'removed',
    category: 'bodywork',
    part_name: 'OEM Mirrors',
    brand: 'Ducati',
    part_number: null,
    cost: null,
    currency: null,
    installed_at: '2024-03-15T00:00:00Z',
    removed_at: '2025-05-01T00:00:00Z',
    mileage_km: 800,
    notes: 'Removed for track use, replaced with block-off plates',
    created_at: '2025-05-01T10:00:00Z',
    updated_at: '2025-05-01T10:00:00Z',
  },
  {
    id: 'mod-4',
    bike_id: 'bike-1',
    user_id: 'user-1',
    action: 'swapped',
    category: 'controls',
    part_name: 'Rearsets',
    brand: 'Woodcraft',
    part_number: 'WC-05-0760B',
    cost: 499.0,
    currency: '$',
    installed_at: '2025-04-10T00:00:00Z',
    removed_at: '2025-11-01T00:00:00Z',
    mileage_km: 600,
    notes: 'Swapped OEM rearsets for Woodcraft GP rearsets',
    created_at: '2025-04-10T10:00:00Z',
    updated_at: '2025-11-01T10:00:00Z',
  },
];

export const modificationHandlers = [
  // GET /api/v1/garage/bikes/:id/mods
  http.get(`${BASE}/garage/bikes/:id/mods`, ({ request, params }) => {
    const url = new URL(request.url);
    const categoryFilter = url.searchParams.get('category');
    const statusFilter = url.searchParams.get('status');
    const bikeId = params.id as string;

    let entries = MOCK_MODIFICATIONS.filter((m) => m.bike_id === bikeId);
    if (categoryFilter) {
      entries = entries.filter((m) => m.category === categoryFilter);
    }
    if (statusFilter === 'active') {
      entries = entries.filter((m) => m.removed_at === null);
    } else if (statusFilter === 'removed') {
      entries = entries.filter((m) => m.removed_at !== null);
    }
    return HttpResponse.json(entries);
  }),

  // POST /api/v1/garage/bikes/:id/mods
  http.post(`${BASE}/garage/bikes/:id/mods`, async ({ params, request }) => {
    const body = (await request.json()) as CreateModificationRequest;
    const newEntry: Modification = {
      id: `mod-${Date.now()}`,
      bike_id: params.id as string,
      user_id: 'user-1',
      action: body.action,
      category: body.category,
      part_name: body.part_name,
      brand: body.brand ?? null,
      part_number: body.part_number ?? null,
      cost: body.cost ?? null,
      currency: body.currency ?? null,
      installed_at: body.installed_at,
      removed_at: body.removed_at ?? null,
      mileage_km: body.mileage_km ?? null,
      notes: body.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(newEntry, { status: 201 });
  }),

  // GET /api/v1/garage/bikes/:id/mods/:mid
  http.get(`${BASE}/garage/bikes/:id/mods/:mid`, ({ params }) => {
    const entry = MOCK_MODIFICATIONS.find((m) => m.id === (params.mid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Modification not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return HttpResponse.json(entry);
  }),

  // PATCH /api/v1/garage/bikes/:id/mods/:mid
  http.patch(`${BASE}/garage/bikes/:id/mods/:mid`, async ({ params, request }) => {
    const entry = MOCK_MODIFICATIONS.find((m) => m.id === (params.mid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Modification not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const body = (await request.json()) as UpdateModificationRequest;
    const updated: Modification = {
      ...entry,
      ...body,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(updated);
  }),

  // DELETE /api/v1/garage/bikes/:id/mods/:mid
  http.delete(`${BASE}/garage/bikes/:id/mods/:mid`, ({ params }) => {
    const entry = MOCK_MODIFICATIONS.find((m) => m.id === (params.mid as string));
    if (!entry) {
      return HttpResponse.json(
        { error: 'Modification not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

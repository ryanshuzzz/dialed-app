import { http, HttpResponse } from 'msw';
import type { ChannelAlias, CreateChannelAliasRequest, UpdateChannelAliasRequest } from '@/api/types';

const BASE = '*/api/v1';

const MOCK_ALIASES: ChannelAlias[] = [
  { id: 'alias-1', raw_name: 'GPS_Speed', canonical_name: 'gps_speed', logger_model: 'AiM Solo 2 DL', created_at: '2025-01-15T10:00:00Z' },
  { id: 'alias-2', raw_name: 'ThrottlePos', canonical_name: 'throttle_pos', logger_model: 'AiM Solo 2 DL', created_at: '2025-01-15T10:00:00Z' },
  { id: 'alias-3', raw_name: 'Engine_RPM', canonical_name: 'rpm', logger_model: null, created_at: '2025-02-01T08:00:00Z' },
  { id: 'alias-4', raw_name: 'LeanAng', canonical_name: 'lean_angle', logger_model: 'AiM EVO5', created_at: '2025-02-10T12:00:00Z' },
  { id: 'alias-5', raw_name: 'FBrake_PSI', canonical_name: 'front_brake_psi', logger_model: 'AiM Solo 2 DL', created_at: '2025-03-01T09:00:00Z' },
];

export const adminHandlers = [
  http.get(`${BASE}/admin/channel-aliases`, () => {
    return HttpResponse.json(MOCK_ALIASES);
  }),

  http.post(`${BASE}/admin/channel-aliases`, async ({ request }) => {
    const body = (await request.json()) as CreateChannelAliasRequest;
    const created: ChannelAlias = {
      id: `alias-${Date.now()}`,
      raw_name: body.raw_name,
      canonical_name: body.canonical_name,
      logger_model: body.logger_model ?? null,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${BASE}/admin/channel-aliases/:id`, async ({ params, request }) => {
    const body = (await request.json()) as UpdateChannelAliasRequest;
    const existing = MOCK_ALIASES.find((a) => a.id === params.id);
    if (!existing) {
      return HttpResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
    }
    const updated: ChannelAlias = { ...existing, ...body };
    return HttpResponse.json(updated);
  }),

  http.delete(`${BASE}/admin/channel-aliases/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];

import { http, HttpResponse } from 'msw';
import type {
  AuthResponse,
  UserProfile,
  ApiKeySummary,
  ApiKeyCreateResponse,
  UpdateProfileRequest,
} from '@/api/types';

const BASE = '*/api/v1';

const MOCK_USER: UserProfile = {
  user_id: 'user-1',
  email: 'rider@dialed.app',
  display_name: 'Alex Rider',
  skill_level: 'expert',
  rider_type: 'competitive',
  units: 'imperial',
};

const MOCK_AUTH_RESPONSE: AuthResponse = {
  user_id: 'user-1',
  token: 'mock-jwt-token-abc123',
  refresh_token: 'mock-refresh-token-xyz789',
};

const MOCK_API_KEYS: ApiKeySummary[] = [
  {
    id: 'key-1',
    name: 'Data Logger Sync',
    last_used_at: '2025-12-15T10:30:00Z',
    expires_at: '2026-12-15T00:00:00Z',
    created_at: '2025-06-01T09:00:00Z',
  },
  {
    id: 'key-2',
    name: 'CI Pipeline',
    last_used_at: null,
    expires_at: null,
    created_at: '2025-09-10T14:00:00Z',
  },
];

let currentUser = { ...MOCK_USER };

export const authHandlers = [
  http.post(`${BASE}/auth/register`, () => {
    return HttpResponse.json(MOCK_AUTH_RESPONSE, { status: 201 });
  }),

  http.post(`${BASE}/auth/login`, () => {
    return HttpResponse.json(MOCK_AUTH_RESPONSE);
  }),

  http.post(`${BASE}/auth/refresh`, () => {
    return HttpResponse.json({ token: 'mock-refreshed-token-def456' });
  }),

  http.get(`${BASE}/auth/me`, () => {
    return HttpResponse.json(currentUser);
  }),

  http.patch(`${BASE}/auth/me`, async ({ request }) => {
    const body = (await request.json()) as UpdateProfileRequest;
    currentUser = { ...currentUser, ...body };
    return HttpResponse.json(currentUser);
  }),

  http.get(`${BASE}/auth/me/api-keys`, () => {
    return HttpResponse.json(MOCK_API_KEYS);
  }),

  http.put(`${BASE}/auth/me/api-keys`, async ({ request }) => {
    const body = (await request.json()) as { name: string; expires_at?: string | null };
    const created: ApiKeyCreateResponse = {
      id: `key-${Date.now()}`,
      name: body.name,
      key: 'dk_live_abc123def456ghi789',
      expires_at: body.expires_at ?? null,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.delete(`${BASE}/auth/me/api-keys/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];

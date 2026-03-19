/**
 * Fetch wrapper for the Dialed API.
 *
 * Reads VITE_GATEWAY_URL, adds /api/v1/ prefix,
 * attaches the JWT from authStore, and throws typed errors.
 */

import { useAuthStore } from '@/stores/authStore';

export interface ErrorResponse {
  error: string;
  code: string;
  request_id?: string;
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public requestId?: string;

  constructor(message: string, code: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

const BASE_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:8000';
const API_PREFIX = '/api/v1';

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${BASE_URL}${API_PREFIX}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorBody: ErrorResponse;
    try {
      errorBody = await response.json() as ErrorResponse;
    } catch {
      errorBody = {
        error: response.statusText || 'Unknown error',
        code: 'INTERNAL_ERROR',
      };
    }
    throw new ApiError(
      errorBody.error,
      errorBody.code,
      response.status,
      errorBody.request_id,
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

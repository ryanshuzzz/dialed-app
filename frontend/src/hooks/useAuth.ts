import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshRequest,
  RefreshResponse,
  UserProfile,
  UpdateProfileRequest,
  ApiKeySummary,
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
} from '@/api/types';

export function useLogin() {
  const store = useAuthStore();
  return useMutation({
    mutationFn: (data: LoginRequest) =>
      apiPost<AuthResponse>('/auth/login', data),
    onSuccess: (resp) => {
      store.setToken(resp.token);
      store.login(resp.token, resp.refresh_token, null as unknown as UserProfile);
    },
  });
}

export function useRegister() {
  const store = useAuthStore();
  return useMutation({
    mutationFn: (data: RegisterRequest) =>
      apiPost<AuthResponse>('/auth/register', data),
    onSuccess: (resp) => {
      store.login(resp.token, resp.refresh_token, null as unknown as UserProfile);
    },
  });
}

export function useRefreshToken() {
  const store = useAuthStore();
  return useMutation({
    mutationFn: (data: RefreshRequest) =>
      apiPost<RefreshResponse>('/auth/refresh', data),
    onSuccess: (resp) => {
      store.setToken(resp.token);
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['auth', 'profile'],
    queryFn: () => apiGet<UserProfile>('/auth/me'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const store = useAuthStore();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) =>
      apiPatch<UserProfile>('/auth/me', data),
    onSuccess: (user) => {
      store.setUser(user);
      queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['auth', 'api-keys'],
    queryFn: () => apiGet<ApiKeySummary[]>('/auth/me/api-keys'),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ApiKeyCreateRequest) =>
      apiPut<ApiKeyCreateResponse>('/auth/me/api-keys', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'api-keys'] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      apiDelete(`/auth/me/api-keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'api-keys'] });
    },
  });
}

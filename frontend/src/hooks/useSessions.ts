import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type {
  Session,
  SessionDetail,
  CreateSessionRequest,
  UpdateSessionRequest,
  SetupSnapshot,
  CreateSnapshotRequest,
  ChangeLog,
  CreateChangeRequest,
} from '@/api/types';

export interface SessionFilters {
  event_id?: string;
  from_date?: string;
  to_date?: string;
}

function buildQuery(filters?: SessionFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.event_id) params.set('event_id', filters.event_id);
  if (filters.from_date) params.set('from_date', filters.from_date);
  if (filters.to_date) params.set('to_date', filters.to_date);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useSessions(filters?: SessionFilters) {
  return useQuery({
    queryKey: ['sessions', filters],
    queryFn: () => apiGet<Session[]>(`/sessions${buildQuery(filters)}`),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => apiGet<SessionDetail>(`/sessions/${sessionId}`),
    enabled: !!sessionId,
    staleTime: 60 * 1000,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSessionRequest) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: '/sessions',
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as Session;
      }
      return apiPost<Session>('/sessions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId, data,
    }: { sessionId: string; data: UpdateSessionRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/sessions/${sessionId}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return null as unknown as Session;
      }
      return apiPatch<Session>(`/sessions/${sessionId}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions', variables.sessionId] });
    },
  });
}

export function useCreateSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId, data,
    }: { sessionId: string; data: CreateSnapshotRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/sessions/${sessionId}/snapshot`,
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as SetupSnapshot;
      }
      return apiPost<SetupSnapshot>(`/sessions/${sessionId}/snapshot`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', variables.sessionId] });
    },
  });
}

export function useCreateChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId, data,
    }: { sessionId: string; data: CreateChangeRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/sessions/${sessionId}/changes`,
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as ChangeLog;
      }
      return apiPost<ChangeLog>(`/sessions/${sessionId}/changes`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['changes', variables.sessionId] });
    },
  });
}

export function useChangeLog(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['changes', sessionId],
    queryFn: () => apiGet<ChangeLog[]>(`/sessions/${sessionId}/changes`),
    enabled: !!sessionId,
  });
}

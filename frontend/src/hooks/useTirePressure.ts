import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type { TirePressureLog, CreateTirePressureRequest } from '@/api/types';

export interface TirePressureFilters {
  context?: string;
  from_date?: string;
  to_date?: string;
}

function buildQuery(filters?: TirePressureFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.context) params.set('context', filters.context);
  if (filters.from_date) params.set('from_date', filters.from_date);
  if (filters.to_date) params.set('to_date', filters.to_date);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useTirePressure(bikeId: string | undefined, filters?: TirePressureFilters) {
  return useQuery({
    queryKey: ['tire-pressure', bikeId, filters],
    queryFn: () =>
      apiGet<TirePressureLog[]>(`/garage/bikes/${bikeId}/tire-pressure${buildQuery(filters)}`),
    enabled: !!bikeId,
  });
}

export function useCreateTirePressure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, data }: { bikeId: string; data: CreateTirePressureRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/tire-pressure`,
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as TirePressureLog;
      }
      return apiPost<TirePressureLog>(`/garage/bikes/${bikeId}/tire-pressure`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tire-pressure', variables.bikeId] });
    },
  });
}

export function useDeleteTirePressure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, readingId }: { bikeId: string; readingId: string }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/tire-pressure/${readingId}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/bikes/${bikeId}/tire-pressure/${readingId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tire-pressure', variables.bikeId] });
    },
  });
}

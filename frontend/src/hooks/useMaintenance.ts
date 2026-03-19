import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type {
  MaintenanceLog,
  CreateMaintenanceRequest,
  UpdateMaintenanceRequest,
  UpcomingMaintenance,
} from '@/api/types';

export interface MaintenanceFilters {
  category?: string;
  from_date?: string;
  to_date?: string;
}

function buildQuery(filters?: MaintenanceFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.from_date) params.set('from_date', filters.from_date);
  if (filters.to_date) params.set('to_date', filters.to_date);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useMaintenance(bikeId: string | undefined, filters?: MaintenanceFilters) {
  return useQuery({
    queryKey: ['maintenance', bikeId, filters],
    queryFn: () =>
      apiGet<MaintenanceLog[]>(`/garage/bikes/${bikeId}/maintenance${buildQuery(filters)}`),
    enabled: !!bikeId,
  });
}

export function useMaintenanceDetail(bikeId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: ['maintenance', bikeId, id],
    queryFn: () =>
      apiGet<MaintenanceLog>(`/garage/bikes/${bikeId}/maintenance/${id}`),
    enabled: !!bikeId && !!id,
  });
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, data }: { bikeId: string; data: CreateMaintenanceRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/maintenance`,
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as MaintenanceLog;
      }
      return apiPost<MaintenanceLog>(`/garage/bikes/${bikeId}/maintenance`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', variables.bikeId] });
      queryClient.invalidateQueries({ queryKey: ['bikes', variables.bikeId] });
    },
  });
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bikeId, id, data,
    }: { bikeId: string; id: string; data: UpdateMaintenanceRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/maintenance/${id}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return null as unknown as MaintenanceLog;
      }
      return apiPatch<MaintenanceLog>(`/garage/bikes/${bikeId}/maintenance/${id}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', variables.bikeId] });
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, id }: { bikeId: string; id: string }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/maintenance/${id}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/bikes/${bikeId}/maintenance/${id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', variables.bikeId] });
      queryClient.invalidateQueries({ queryKey: ['bikes', variables.bikeId] });
    },
  });
}

export function useUpcomingMaintenance(bikeId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance', bikeId, 'upcoming'],
    queryFn: () =>
      apiGet<UpcomingMaintenance>(`/garage/bikes/${bikeId}/maintenance/upcoming`),
    enabled: !!bikeId,
  });
}

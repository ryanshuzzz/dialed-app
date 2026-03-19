import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type {
  Modification,
  CreateModificationRequest,
  UpdateModificationRequest,
} from '@/api/types';

export interface ModificationFilters {
  category?: string;
  status?: 'active' | 'removed';
}

function buildQuery(filters?: ModificationFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useModifications(bikeId: string | undefined, filters?: ModificationFilters) {
  return useQuery({
    queryKey: ['modifications', bikeId, filters],
    queryFn: () =>
      apiGet<Modification[]>(`/garage/bikes/${bikeId}/mods${buildQuery(filters)}`),
    enabled: !!bikeId,
  });
}

export function useCreateModification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, data }: { bikeId: string; data: CreateModificationRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/mods`,
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as Modification;
      }
      return apiPost<Modification>(`/garage/bikes/${bikeId}/mods`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modifications', variables.bikeId] });
      queryClient.invalidateQueries({ queryKey: ['bikes', variables.bikeId] });
    },
  });
}

export function useUpdateModification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bikeId, modId, data,
    }: { bikeId: string; modId: string; data: UpdateModificationRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/mods/${modId}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return null as unknown as Modification;
      }
      return apiPatch<Modification>(`/garage/bikes/${bikeId}/mods/${modId}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modifications', variables.bikeId] });
    },
  });
}

export function useDeleteModification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, modId }: { bikeId: string; modId: string }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/mods/${modId}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/bikes/${bikeId}/mods/${modId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['modifications', variables.bikeId] });
      queryClient.invalidateQueries({ queryKey: ['bikes', variables.bikeId] });
    },
  });
}

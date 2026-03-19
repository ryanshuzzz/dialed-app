import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type { OwnershipHistory, CreateOwnershipRequest } from '@/api/types';

export function useOwnership(bikeId: string | undefined) {
  return useQuery({
    queryKey: ['ownership', bikeId],
    queryFn: () =>
      apiGet<OwnershipHistory[]>(`/garage/bikes/${bikeId}/ownership`),
    enabled: !!bikeId,
  });
}

export function useCreateOwnershipEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, data }: { bikeId: string; data: CreateOwnershipRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/ownership`,
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as OwnershipHistory;
      }
      return apiPost<OwnershipHistory>(`/garage/bikes/${bikeId}/ownership`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ownership', variables.bikeId] });
    },
  });
}

export function useDeleteOwnershipEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, ownershipId }: { bikeId: string; ownershipId: string }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}/ownership/${ownershipId}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/bikes/${bikeId}/ownership/${ownershipId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ownership', variables.bikeId] });
    },
  });
}

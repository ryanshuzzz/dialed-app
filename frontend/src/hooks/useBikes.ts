import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type {
  Bike,
  BikeDetail,
  CreateBikeRequest,
  UpdateBikeRequest,
} from '@/api/types';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useBikes() {
  return useQuery({
    queryKey: ['bikes'],
    queryFn: () => apiGet<Bike[]>('/garage/bikes'),
    staleTime: STALE_TIME,
  });
}

export function useBike(bikeId: string | undefined) {
  return useQuery({
    queryKey: ['bikes', bikeId],
    queryFn: () => apiGet<BikeDetail>(`/garage/bikes/${bikeId}`),
    enabled: !!bikeId,
    staleTime: STALE_TIME,
  });
}

export function useCreateBike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateBikeRequest) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: '/garage/bikes',
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as Bike;
      }
      return apiPost<Bike>('/garage/bikes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bikes'] });
    },
  });
}

export function useUpdateBike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bikeId, data }: { bikeId: string; data: UpdateBikeRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return null as unknown as Bike;
      }
      return apiPatch<Bike>(`/garage/bikes/${bikeId}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bikes'] });
      queryClient.invalidateQueries({ queryKey: ['bikes', variables.bikeId] });
    },
  });
}

export function useDeleteBike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bikeId: string) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/bikes/${bikeId}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/bikes/${bikeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bikes'] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type { Track, CreateTrackRequest, UpdateTrackRequest } from '@/api/types';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useTracks() {
  return useQuery({
    queryKey: ['tracks'],
    queryFn: () => apiGet<Track[]>('/garage/tracks'),
    staleTime: STALE_TIME,
  });
}

export function useTrack(trackId: string | undefined) {
  return useQuery({
    queryKey: ['tracks', trackId],
    queryFn: () => apiGet<Track>(`/garage/tracks/${trackId}`),
    enabled: !!trackId,
    staleTime: STALE_TIME,
  });
}

export function useCreateTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTrackRequest) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: '/garage/tracks',
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as Track;
      }
      return apiPost<Track>('/garage/tracks', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
}

export function useUpdateTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackId, data }: { trackId: string; data: UpdateTrackRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/tracks/${trackId}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return null as unknown as Track;
      }
      return apiPatch<Track>(`/garage/tracks/${trackId}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      queryClient.invalidateQueries({ queryKey: ['tracks', variables.trackId] });
    },
  });
}

export function useDeleteTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trackId: string) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/tracks/${trackId}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/tracks/${trackId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/api/client';
import { useOfflineStore } from '@/stores/offlineStore';
import type { TrackEvent, CreateEventRequest, UpdateEventRequest } from '@/api/types';

export interface EventFilters {
  bike_id?: string;
  track_id?: string;
  from_date?: string;
  to_date?: string;
}

function buildQuery(filters?: EventFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.bike_id) params.set('bike_id', filters.bike_id);
  if (filters.track_id) params.set('track_id', filters.track_id);
  if (filters.from_date) params.set('from_date', filters.from_date);
  if (filters.to_date) params.set('to_date', filters.to_date);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => apiGet<TrackEvent[]>(`/garage/events${buildQuery(filters)}`),
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: () => apiGet<TrackEvent>(`/garage/events/${eventId}`),
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateEventRequest) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: '/garage/events',
          method: 'POST',
          body: JSON.stringify(data),
        });
        return null as unknown as TrackEvent;
      }
      return apiPost<TrackEvent>('/garage/events', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: UpdateEventRequest }) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/events/${eventId}`,
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        return null as unknown as TrackEvent;
      }
      return apiPatch<TrackEvent>(`/garage/events/${eventId}`, data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.eventId] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!navigator.onLine) {
        await useOfflineStore.getState().enqueue({
          endpoint: `/garage/events/${eventId}`,
          method: 'DELETE',
        });
        return;
      }
      return apiDelete(`/garage/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

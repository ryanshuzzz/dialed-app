import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { ChannelSummary, LapData, SessionAnalysis } from '@/api/types';

const STALE_TIME = 10 * 60 * 1000; // 10 minutes

export function useChannels(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['telemetry', sessionId, 'channels'],
    queryFn: () => apiGet<ChannelSummary>(`/telemetry/${sessionId}/channels`),
    enabled: !!sessionId,
    staleTime: STALE_TIME,
  });
}

export function useLapData(
  sessionId: string | undefined,
  lapNumber: number | undefined,
  hz?: number,
  channels?: string[],
) {
  return useQuery({
    queryKey: ['telemetry', sessionId, 'lap', lapNumber, hz, channels],
    queryFn: () => {
      const params = new URLSearchParams();
      if (hz !== undefined) params.set('hz', String(hz));
      if (channels?.length) params.set('channels', channels.join(','));
      const qs = params.toString();
      const suffix = qs ? `?${qs}` : '';
      return apiGet<LapData>(`/telemetry/${sessionId}/lap/${lapNumber}${suffix}`);
    },
    enabled: !!sessionId && lapNumber !== undefined && lapNumber >= 1,
    staleTime: STALE_TIME,
  });
}

export function useAnalysis(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['telemetry', sessionId, 'analysis'],
    queryFn: () => apiGet<SessionAnalysis>(`/telemetry/${sessionId}/analysis`),
    enabled: !!sessionId,
    staleTime: STALE_TIME,
  });
}

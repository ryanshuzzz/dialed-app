import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { ProgressOverview, EfficacyOverview, SessionHistory } from '@/api/types';

export function useLapTrends() {
  return useQuery({
    queryKey: ['progress'],
    queryFn: () => apiGet<ProgressOverview>('/progress'),
  });
}

export function useEfficacy() {
  return useQuery({
    queryKey: ['progress', 'efficacy'],
    queryFn: () => apiGet<EfficacyOverview>('/progress/efficacy'),
  });
}

export function useSessionHistory() {
  return useQuery({
    queryKey: ['progress', 'sessions'],
    queryFn: () => apiGet<SessionHistory>('/progress/sessions'),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiGet, apiPatch } from '@/api/client';
import type {
  SuggestRequest,
  SuggestResponse,
  SuggestionSummary,
  Suggestion,
  SuggestionChange,
  UpdateChangeStatusRequest,
  RecordOutcomeRequest,
} from '@/api/types';

export function useRequestSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SuggestRequest) =>
      apiPost<SuggestResponse>('/suggest', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['suggestions', variables.session_id],
      });
    },
  });
}

export function useSuggestions(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['suggestions', sessionId],
    queryFn: () =>
      apiGet<SuggestionSummary[]>(`/suggest/session/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function useSuggestion(suggestionId: string | undefined) {
  return useQuery({
    queryKey: ['suggestions', 'detail', suggestionId],
    queryFn: () =>
      apiGet<Suggestion>(`/suggest/${suggestionId}`),
    enabled: !!suggestionId,
  });
}

export function useUpdateChangeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      suggestionId, changeId, data,
    }: { suggestionId: string; changeId: string; data: UpdateChangeStatusRequest }) =>
      apiPatch<SuggestionChange>(
        `/suggest/${suggestionId}/changes/${changeId}`,
        data,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['suggestions', 'detail', variables.suggestionId],
      });
    },
  });
}

export function useRecordChangeOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      suggestionId, changeId, data,
    }: { suggestionId: string; changeId: string; data: RecordOutcomeRequest }) =>
      apiPatch<SuggestionChange>(
        `/suggest/${suggestionId}/changes/${changeId}/outcome`,
        data,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['suggestions', 'detail', variables.suggestionId],
      });
      queryClient.invalidateQueries({ queryKey: ['progress', 'efficacy'] });
    },
  });
}

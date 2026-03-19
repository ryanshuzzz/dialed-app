import { useMutation, useQuery } from '@tanstack/react-query';
import { apiUpload, apiGet, apiPost } from '@/api/client';
import type {
  IngestionJobCreated,
  IngestionJob,
  ConfirmRequest,
  ConfirmResponse,
} from '@/api/types';

export function useIngestCsv() {
  return useMutation({
    mutationFn: ({ sessionId, file }: { sessionId: string; file: File }) => {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('file', file);
      return apiUpload<IngestionJobCreated>('/ingest/csv', formData);
    },
  });
}

export function useIngestOcr() {
  return useMutation({
    mutationFn: ({ sessionId, file }: { sessionId: string; file: File }) => {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('file', file);
      return apiUpload<IngestionJobCreated>('/ingest/ocr', formData);
    },
  });
}

export function useIngestVoice() {
  return useMutation({
    mutationFn: ({ sessionId, file }: { sessionId: string; file: File }) => {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('file', file);
      return apiUpload<IngestionJobCreated>('/ingest/voice', formData);
    },
  });
}

export function useIngestionJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ['ingestion', jobId],
    queryFn: () => apiGet<IngestionJob>(`/ingest/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'complete' || status === 'failed') return false;
      return 2000; // Poll every 2s while pending/processing
    },
  });
}

export function useConfirmIngestion() {
  return useMutation({
    mutationFn: ({ jobId, data }: { jobId: string; data: ConfirmRequest }) =>
      apiPost<ConfirmResponse>(`/ingest/jobs/${jobId}/confirm`, data),
  });
}

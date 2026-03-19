import { http, HttpResponse } from 'msw';

const BASE = '*/api/v1';

export const ingestionHandlers = [
  // POST /api/v1/ingest/csv
  http.post(`${BASE}/ingest/csv`, () => {
    return HttpResponse.json({ job_id: 'mock-job-csv' }, { status: 201 });
  }),

  // POST /api/v1/ingest/ocr
  http.post(`${BASE}/ingest/ocr`, () => {
    return HttpResponse.json({ job_id: 'mock-job-ocr' }, { status: 201 });
  }),

  // POST /api/v1/ingest/voice
  http.post(`${BASE}/ingest/voice`, () => {
    return HttpResponse.json({ job_id: 'mock-job-voice' }, { status: 201 });
  }),

  // GET /api/v1/ingest/jobs/:id
  http.get(`${BASE}/ingest/jobs/:id`, ({ params }) => {
    const jobId = params.id as string;
    return HttpResponse.json({
      id: jobId,
      session_id: 'session-1',
      source: jobId.includes('csv') ? 'csv' : jobId.includes('ocr') ? 'ocr' : 'voice',
      status: 'complete',
      result: {
        lap_times: [97850, 98200, 98900, 99100, 97500],
        best_lap_ms: 97500,
        total_laps: 5,
      },
      error_message: null,
      confidence: 0.95,
      created_at: '2025-09-12T09:00:00Z',
      completed_at: '2025-09-12T09:01:00Z',
    });
  }),

  // POST /api/v1/ingest/jobs/:id/confirm
  http.post(`${BASE}/ingest/jobs/:id/confirm`, () => {
    return HttpResponse.json({
      status: 'confirmed',
      session_id: 'session-1',
    });
  }),

  // GET /api/v1/ingest/jobs/:id/stream — fallback JSON since MSW doesn't support SSE
  http.get(`${BASE}/ingest/jobs/:id/stream`, ({ params }) => {
    const jobId = params.id as string;
    return HttpResponse.json({
      id: jobId,
      status: 'complete',
      result: {
        lap_times: [97850, 98200, 98900],
        best_lap_ms: 97850,
      },
    });
  }),
];

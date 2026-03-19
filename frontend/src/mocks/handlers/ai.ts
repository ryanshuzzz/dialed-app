import { http, HttpResponse } from 'msw';
import type {
  SuggestionSummary,
  Suggestion,
  SuggestionChange,
  UpdateChangeStatusRequest,
  RecordOutcomeRequest,
} from '@/api/types';

const BASE = '*/api/v1';

const MOCK_CHANGES: SuggestionChange[] = [
  {
    id: 'sc-1',
    suggestion_id: 'sug-1',
    parameter: 'rear_rebound',
    suggested_value: '16',
    symptom: 'Rear kicks on corner exit under acceleration',
    confidence: 0.87,
    applied_status: 'not_applied',
    actual_value: null,
    outcome_lap_delta_ms: null,
    applied_at: null,
    created_at: '2025-09-12T12:00:00Z',
  },
  {
    id: 'sc-2',
    suggestion_id: 'sug-1',
    parameter: 'front_compression',
    suggested_value: '9',
    symptom: 'Front dives excessively under hard braking',
    confidence: 0.72,
    applied_status: 'not_applied',
    actual_value: null,
    outcome_lap_delta_ms: null,
    applied_at: null,
    created_at: '2025-09-12T12:00:00Z',
  },
  {
    id: 'sc-3',
    suggestion_id: 'sug-1',
    parameter: 'rear_preload',
    suggested_value: '8',
    symptom: 'Rear squats too much on acceleration',
    confidence: 0.65,
    applied_status: 'not_applied',
    actual_value: null,
    outcome_lap_delta_ms: null,
    applied_at: null,
    created_at: '2025-09-12T12:00:00Z',
  },
];

const MOCK_SUGGESTION: Suggestion = {
  id: 'sug-1',
  session_id: 'session-1',
  user_id: 'user-1',
  suggestion_text:
    'Based on your feedback about rear sliding on exit and the telemetry data showing excessive rear rebound speed, I recommend slowing the rear rebound by 2 clicks. Additionally, softening front compression will improve trail braking feel and mid-corner stability.',
  changes: MOCK_CHANGES,
  created_at: '2025-09-12T12:00:00Z',
};

const MOCK_SUMMARIES: SuggestionSummary[] = [
  {
    id: 'sug-1',
    session_id: 'session-1',
    user_id: 'user-1',
    suggestion_text: MOCK_SUGGESTION.suggestion_text,
    change_count: 3,
    applied_count: 0,
    created_at: '2025-09-12T12:00:00Z',
  },
  {
    id: 'sug-2',
    session_id: 'session-1',
    user_id: 'user-1',
    suggestion_text:
      'Your braking data shows late and aggressive braking into T1. Consider moving brake marker 5m earlier.',
    change_count: 1,
    applied_count: 1,
    created_at: '2025-09-12T14:00:00Z',
  },
];

export const aiHandlers = [
  // POST /api/v1/suggest
  http.post(`${BASE}/suggest`, () => {
    return HttpResponse.json({ job_id: 'mock-ai-job-id' }, { status: 201 });
  }),

  // GET /api/v1/suggest/session/:session_id
  http.get(`${BASE}/suggest/session/:session_id`, () => {
    return HttpResponse.json(MOCK_SUMMARIES);
  }),

  // GET /api/v1/suggest/:id
  http.get(`${BASE}/suggest/:id`, () => {
    return HttpResponse.json(MOCK_SUGGESTION);
  }),

  // PATCH /api/v1/suggest/:id/changes/:cid
  http.patch(`${BASE}/suggest/:id/changes/:cid`, async ({ params, request }) => {
    const body = (await request.json()) as UpdateChangeStatusRequest;
    const change = MOCK_CHANGES.find((c) => c.id === params.cid);
    if (!change) {
      return HttpResponse.json(
        { error: 'Change not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const updated: SuggestionChange = {
      ...change,
      applied_status: body.applied_status,
      actual_value: body.actual_value ?? change.actual_value,
      applied_at: new Date().toISOString(),
    };
    return HttpResponse.json(updated);
  }),

  // PATCH /api/v1/suggest/:id/changes/:cid/outcome
  http.patch(`${BASE}/suggest/:id/changes/:cid/outcome`, async ({ params, request }) => {
    const body = (await request.json()) as RecordOutcomeRequest;
    const change = MOCK_CHANGES.find((c) => c.id === params.cid);
    if (!change) {
      return HttpResponse.json(
        { error: 'Change not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }
    const updated: SuggestionChange = {
      ...change,
      outcome_lap_delta_ms: body.outcome_lap_delta_ms,
    };
    return HttpResponse.json(updated);
  }),

  // GET /api/v1/suggest/:id/stream — fallback JSON since MSW doesn't support SSE
  http.get(`${BASE}/suggest/:id/stream`, () => {
    return HttpResponse.json({
      status: 'complete',
      suggestion: MOCK_SUGGESTION,
    });
  }),
];

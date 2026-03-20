import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useSession,
  useChangeLog,
  useUpdateSession,
  useCreateChange,
} from '@/hooks/useSessions';
import { useEvent } from '@/hooks/useEvents';
import {
  useSuggestions,
  useSuggestion,
  useRequestSuggestion,
  useUpdateChangeStatus,
} from '@/hooks/useSuggestions';
import { useChannels, useLapData, useAnalysis } from '@/hooks/useTelemetry';
import { useSSE } from '@/hooks/useSSE';
import { SetupSnapshotView } from '@/components/session/SetupSnapshotView';
import { ChangeLogEntry } from '@/components/session/ChangeLogEntry';
import { SuggestionCard } from '@/components/session/SuggestionCard';
import { SuggestionStream } from '@/components/session/SuggestionStream';
import { TelemetryChart } from '@/components/telemetry/TelemetryChart';
import { LapSelector } from '@/components/telemetry/LapSelector';
import { ChannelToggle } from '@/components/telemetry/ChannelToggle';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, '0')}` : `${seconds}s`;
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading, error, refetch } = useSession(id);
  const { data: parentEvent } = useEvent(session?.event_id);
  const isRoadEvent = parentEvent?.venue === 'road';
  const { data: changeLog } = useChangeLog(id);
  const updateSession = useUpdateSession();
  const createChange = useCreateChange();

  const [notesDraft, setNotesDraft] = useState('');
  useEffect(() => {
    if (session) {
      setNotesDraft(session.rider_feedback ?? '');
    }
  }, [session?.id, session?.rider_feedback]);

  const [chgParameter, setChgParameter] = useState('');
  const [chgFrom, setChgFrom] = useState('');
  const [chgTo, setChgTo] = useState('');
  const [chgRationale, setChgRationale] = useState('');

  const handleSaveNotes = useCallback(() => {
    if (!id) return;
    updateSession.mutate({
      sessionId: id,
      data: { rider_feedback: notesDraft.trim() ? notesDraft : null },
    });
  }, [id, notesDraft, updateSession]);

  const handleAddChange = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !chgParameter.trim() || !chgTo.trim()) return;
      createChange.mutate(
        {
          sessionId: id,
          data: {
            parameter: chgParameter.trim(),
            from_value: chgFrom.trim() ? chgFrom.trim() : null,
            to_value: chgTo.trim(),
            rationale: chgRationale.trim() ? chgRationale.trim() : null,
          },
        },
        {
          onSuccess: () => {
            setChgParameter('');
            setChgFrom('');
            setChgTo('');
            setChgRationale('');
          },
        },
      );
    },
    [id, chgParameter, chgFrom, chgTo, chgRationale, createChange],
  );

  // Suggestion state
  const { data: suggestions } = useSuggestions(id);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | undefined>(undefined);
  const { data: activeSuggestion } = useSuggestion(activeSuggestionId);
  const requestSuggestion = useRequestSuggestion();
  const updateChangeStatus = useUpdateChangeStatus();

  // SSE streaming state
  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useSSE(
    streamJobId ? `/suggest/${streamJobId}/stream` : null,
    {
      onToken: (text) => {
        setStreamText((prev) => prev + text);
      },
      onComplete: (data) => {
        setIsStreaming(false);
        setStreamJobId(null);
        // If the response contains a suggestion ID, load it
        const result = data as Record<string, unknown> | undefined;
        if (result?.suggestion) {
          const sug = result.suggestion as { id?: string };
          if (sug.id) {
            setActiveSuggestionId(sug.id);
          }
        }
      },
      onFailed: () => {
        setIsStreaming(false);
        setStreamJobId(null);
      },
    },
  );

  const telemetrySessionId = !isRoadEvent ? id : undefined;

  const { data: channelSummary } = useChannels(telemetrySessionId);
  const { data: analysis } = useAnalysis(telemetrySessionId);
  const totalLaps = analysis?.lap_segments?.length ?? 0;
  const [selectedLap, setSelectedLap] = useState(1);
  const [activeChannels, setActiveChannels] = useState<string[]>(['gps_speed', 'throttle_pos']);
  const { data: lapData } = useLapData(
    !isRoadEvent && totalLaps > 0 ? id : undefined,
    !isRoadEvent && totalLaps > 0 ? selectedLap : undefined,
  );

  const handleRequestSuggestion = useCallback(async () => {
    if (!id) return;
    try {
      const result = await requestSuggestion.mutateAsync({ session_id: id });
      setStreamText('');
      setIsStreaming(true);
      setStreamJobId(result.job_id);
    } catch {
      // Error handled by mutation
    }
  }, [id, requestSuggestion]);

  const handleApply = useCallback(
    (changeId: string) => {
      if (!activeSuggestionId) return;
      updateChangeStatus.mutate({
        suggestionId: activeSuggestionId,
        changeId,
        data: { applied_status: 'applied' },
      });
    },
    [activeSuggestionId, updateChangeStatus],
  );

  const handleSkip = useCallback(
    (changeId: string) => {
      if (!activeSuggestionId) return;
      updateChangeStatus.mutate({
        suggestionId: activeSuggestionId,
        changeId,
        data: { applied_status: 'skipped' },
      });
    },
    [activeSuggestionId, updateChangeStatus],
  );

  const handleModify = useCallback(
    (changeId: string, actualValue: string) => {
      if (!activeSuggestionId) return;
      updateChangeStatus.mutate({
        suggestionId: activeSuggestionId,
        changeId,
        data: { applied_status: 'applied_modified', actual_value: actualValue },
      });
    },
    [activeSuggestionId, updateChangeStatus],
  );

  const handleToggleChannel = (name: string) => {
    setActiveChannels((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <LoadingSkeleton variant="lines" count={4} />
        <LoadingSkeleton variant="cards" count={2} />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto">
        <ErrorState
          message="Failed to load session."
          onRetry={() => refetch()}
        />
        <div className="text-center mt-4">
          <Link to="/" className="text-blue-600 hover:underline text-sm">
            Back to Garage
          </Link>
        </div>
      </div>
    );
  }

  const bestLap = session.csv_best_lap_ms ?? session.manual_best_lap_ms;

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="session-detail">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold">Session</h2>
            <span
              className="px-3 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 capitalize"
              data-testid="session-type-badge"
            >
              {session.session_type}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Created {new Date(session.created_at).toLocaleDateString()}
          </p>
        </div>
        {!isRoadEvent && bestLap != null && (
          <div className="sm:text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Best Lap</p>
            <p className="text-2xl font-bold text-green-600" data-testid="best-lap">
              {formatLapTime(bestLap)}
            </p>
          </div>
        )}
      </div>

      {/* Session notes (rider feedback) — editable */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Session notes</h3>
        <p className="text-xs text-gray-500">
          {isRoadEvent
            ? 'How the bike felt, route or traffic notes — also used as AI context.'
            : 'How the bike felt, track conditions, anything the team should remember (also used as AI context).'}
        </p>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          placeholder="e.g. Front pushing mid-corner, rear grip good…"
          data-testid="rider-feedback"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={updateSession.isPending}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateSession.isPending ? 'Saving…' : 'Save notes'}
          </button>
          {updateSession.isError && (
            <span className="text-xs text-red-600">Could not save notes.</span>
          )}
        </div>
      </div>

      {session.ride_metrics &&
        (session.ride_metrics.distance_km != null ||
          session.ride_metrics.duration_ms != null ||
          session.ride_metrics.fuel_used_l != null ||
          session.ride_metrics.odometer_km != null ||
          session.ride_metrics.fuel_efficiency_l_per_100km != null) && (
          <div
            className="bg-white rounded-lg border border-gray-200 p-4"
            data-testid="ride-metrics-section"
          >
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Ride metrics</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {session.ride_metrics.distance_km != null && (
                <>
                  <dt className="text-gray-500">Distance</dt>
                  <dd className="font-medium text-gray-900">{session.ride_metrics.distance_km} km</dd>
                </>
              )}
              {session.ride_metrics.duration_ms != null && (
                <>
                  <dt className="text-gray-500">Duration</dt>
                  <dd className="font-medium text-gray-900">
                    {(session.ride_metrics.duration_ms / 60000).toFixed(1)} min
                  </dd>
                </>
              )}
              {session.ride_metrics.fuel_used_l != null && (
                <>
                  <dt className="text-gray-500">Fuel used</dt>
                  <dd className="font-medium text-gray-900">{session.ride_metrics.fuel_used_l} L</dd>
                </>
              )}
              {session.ride_metrics.odometer_km != null && (
                <>
                  <dt className="text-gray-500">Odometer</dt>
                  <dd className="font-medium text-gray-900">{session.ride_metrics.odometer_km} km</dd>
                </>
              )}
              {session.ride_metrics.fuel_efficiency_l_per_100km != null && (
                <>
                  <dt className="text-gray-500">Fuel economy</dt>
                  <dd className="font-medium text-gray-900">
                    {session.ride_metrics.fuel_efficiency_l_per_100km} L/100km
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

      {/* Tire Info */}
      {(session.tire_front || session.tire_rear) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {session.tire_front && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Front Tire</h4>
              <p className="text-sm font-medium text-gray-900">
                {session.tire_front.brand} {session.tire_front.compound}
              </p>
              {session.tire_front.laps != null && (
                <p className="text-xs text-gray-400">{session.tire_front.laps} laps</p>
              )}
            </div>
          )}
          {session.tire_rear && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Rear Tire</h4>
              <p className="text-sm font-medium text-gray-900">
                {session.tire_rear.brand} {session.tire_rear.compound}
              </p>
              {session.tire_rear.laps != null && (
                <p className="text-xs text-gray-400">{session.tire_rear.laps} laps</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setup Snapshot */}
      <SetupSnapshotView snapshots={session.snapshots ?? []} />

      {/* Change Log */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Setup changes</h3>
        <p className="text-sm text-gray-500 mb-3">
          Record clicks, spring preload, tire pressure tweaks — anything you changed for this session.
        </p>

        <form
          onSubmit={handleAddChange}
          className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-3"
          data-testid="add-change-form"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="chg-parameter">
                Parameter *
              </label>
              <input
                id="chg-parameter"
                value={chgParameter}
                onChange={(e) => setChgParameter(e.target.value)}
                placeholder="e.g. front.compression"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="chg-to">
                New value *
              </label>
              <input
                id="chg-to"
                value={chgTo}
                onChange={(e) => setChgTo(e.target.value)}
                placeholder="e.g. 12 clicks out"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="chg-from">
                Previous value
              </label>
              <input
                id="chg-from"
                value={chgFrom}
                onChange={(e) => setChgFrom(e.target.value)}
                placeholder="optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="chg-why">
                Why / notes
              </label>
              <input
                id="chg-why"
                value={chgRationale}
                onChange={(e) => setChgRationale(e.target.value)}
                placeholder="optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createChange.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            data-testid="add-change-submit"
          >
            {createChange.isPending ? 'Adding…' : 'Add change'}
          </button>
          {createChange.isError && (
            <p className="text-xs text-red-600">Could not add change.</p>
          )}
        </form>

        {(changeLog ?? session.changes ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No changes recorded for this session.</p>
        ) : (
          <div
            className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4"
            data-testid="change-log"
          >
            {(changeLog ?? session.changes ?? []).map((change) => (
              <ChangeLogEntry key={change.id} change={change} />
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
          <h3 className="text-lg font-semibold text-gray-800">AI Suggestions</h3>
          <button
            onClick={handleRequestSuggestion}
            disabled={requestSuggestion.isPending || isStreaming}
            className="px-4 py-2 min-h-[44px] bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-start sm:self-auto"
            data-testid="request-suggestion-button"
          >
            {requestSuggestion.isPending ? 'Requesting...' : 'Get AI Suggestion'}
          </button>
        </div>

        {/* SSE stream output */}
        {(isStreaming || streamText) && (
          <div className="mb-4">
            <SuggestionStream text={streamText} isStreaming={isStreaming} />
          </div>
        )}

        {/* Existing suggestions list */}
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2 mb-4">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSuggestionId(s.id)}
                className={`w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors ${
                  activeSuggestionId === s.id
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                data-testid="suggestion-summary"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {s.applied_count ?? 0}/{s.change_count ?? 0} applied
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {s.suggestion_text}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Active suggestion detail with change cards */}
        {activeSuggestion?.changes && activeSuggestion.changes.length > 0 && (
          <div className="space-y-3" data-testid="suggestion-changes">
            {activeSuggestion.changes.map((change) => (
              <SuggestionCard
                key={change.id}
                change={change}
                onApply={handleApply}
                onSkip={handleSkip}
                onModify={handleModify}
              />
            ))}
          </div>
        )}
      </div>

      {/* Telemetry — hidden for road events to avoid irrelevant empty/error states */}
      {!isRoadEvent && channelSummary && channelSummary.channels.length > 0 && (
        <div data-testid="telemetry-section">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Telemetry</h3>

          <div className="space-y-4">
            <ChannelToggle
              channels={channelSummary.channels}
              activeChannels={activeChannels}
              onToggle={handleToggleChannel}
            />

            {totalLaps > 0 && (
              <LapSelector
                totalLaps={totalLaps}
                selectedLap={selectedLap}
                onSelect={setSelectedLap}
              />
            )}

            <div className="w-full overflow-x-auto">
              <TelemetryChart
                points={lapData?.points ?? []}
                activeChannels={activeChannels}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

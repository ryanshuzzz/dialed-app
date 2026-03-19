import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSession, useChangeLog } from '@/hooks/useSessions';
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

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, '0')}` : `${seconds}s`;
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading, error } = useSession(id);
  const { data: changeLog } = useChangeLog(id);

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

  // Telemetry state
  const { data: channelSummary } = useChannels(id);
  const { data: analysis } = useAnalysis(id);
  const totalLaps = analysis?.lap_segments?.length ?? 0;
  const [selectedLap, setSelectedLap] = useState(1);
  const [activeChannels, setActiveChannels] = useState<string[]>(['gps_speed', 'throttle_pos']);
  const { data: lapData } = useLapData(
    totalLaps > 0 ? id : undefined,
    totalLaps > 0 ? selectedLap : undefined,
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
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading session...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-red-500">Failed to load session.</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          Back to Garage
        </Link>
      </div>
    );
  }

  const bestLap = session.csv_best_lap_ms ?? session.manual_best_lap_ms;

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="session-detail">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">Session</h2>
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
        {bestLap != null && (
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Best Lap</p>
            <p className="text-2xl font-bold text-green-600" data-testid="best-lap">
              {formatLapTime(bestLap)}
            </p>
          </div>
        )}
      </div>

      {/* Rider Feedback */}
      {session.rider_feedback && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Rider Feedback</h3>
          <p className="text-sm text-gray-600" data-testid="rider-feedback">
            {session.rider_feedback}
          </p>
        </div>
      )}

      {/* Tire Info */}
      {(session.tire_front || session.tire_rear) && (
        <div className="grid grid-cols-2 gap-4">
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
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Change Log</h3>
        {(changeLog ?? session.changes ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">No changes recorded for this session.</p>
        ) : (
          <div
            className="bg-white rounded-lg border border-gray-200 p-4"
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">AI Suggestions</h3>
          <button
            onClick={handleRequestSuggestion}
            disabled={requestSuggestion.isPending || isStreaming}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
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

      {/* Telemetry */}
      {channelSummary && channelSummary.channels.length > 0 && (
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

            <TelemetryChart
              points={lapData?.points ?? []}
              activeChannels={activeChannels}
            />
          </div>
        </div>
      )}
    </div>
  );
}

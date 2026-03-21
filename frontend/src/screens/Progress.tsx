import { useState, useMemo } from 'react';
import { ChevronDown, TrendingDown, Flag, MapPin } from 'lucide-react';
import { useLapTrends, useEfficacy, useSessionHistory } from '@/hooks/useProgress';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
}

export default function Progress() {
  const { data: progress, isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useLapTrends();
  const { data: efficacy, isLoading: efficacyLoading } = useEfficacy();
  const { data: history, isLoading: historyLoading } = useSessionHistory();

  const [selectedTrack] = useState<string | null>(null);

  const isLoading = progressLoading || efficacyLoading || historyLoading;

  const sessions = useMemo(() => {
    const trend = progress?.lap_time_trend ?? [];
    return trend.map((item) => ({
      date: item.date,
      time: (item.best_lap_ms ?? 0) / 1000,
    }));
  }, [progress]);

  const minTime = sessions.length > 0 ? Math.min(...sessions.map(s => s.time)) : 0;
  const maxTime = sessions.length > 0 ? Math.max(...sessions.map(s => s.time)) : 0;

  const bestLapTracks = useMemo(() => {
    if (!progress?.best_laps_by_track) return [];
    return progress.best_laps_by_track.map((b) => ({
      name: b.track_name,
      config: '',
      best: formatLapTime(b.best_lap_ms),
      date: b.date,
    }));
  }, [progress]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border-subtle bg-background safe-area-top">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[480px] px-4 py-6">
          <LoadingSkeleton variant="lines" count={3} />
          <div className="mt-4">
            <LoadingSkeleton variant="cards" count={3} />
          </div>
        </main>
      </div>
    );
  }

  if (progressError) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="border-b border-border-subtle bg-background safe-area-top">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[480px] px-4 py-6">
          <ErrorState message="Failed to load progress data." onRetry={() => refetchProgress()} />
        </main>
      </div>
    );
  }

  const hasData = sessions.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          {selectedTrack && (
            <button className="mt-2 flex items-center gap-2 text-foreground-secondary hover:text-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{selectedTrack}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        {!hasData ? (
          <EmptyState
            title="No progress data yet"
            description="Log track sessions to start seeing your lap time trends and improvement stats."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Lap Time Trend Chart */}
            <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Lap Time Trend</h3>
              <div className="relative h-48">
                <svg className="h-full w-full" viewBox="0 0 320 160" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[0, 40, 80, 120, 160].map((y) => (
                    <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
                  ))}

                  {/* Data line */}
                  {sessions.length > 1 && (
                    <path
                      d={sessions.map((s, i) => {
                        const x = (i / (sessions.length - 1)) * 320;
                        const y = 160 - ((s.time - minTime + 5) / (maxTime - minTime + 10)) * 160;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#E8520A"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data points */}
                  {sessions.map((s, i) => {
                    const x = sessions.length > 1 ? (i / (sessions.length - 1)) * 320 : 160;
                    const y = sessions.length > 1
                      ? 160 - ((s.time - minTime + 5) / (maxTime - minTime + 10)) * 160
                      : 80;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="5"
                        fill="#0A0A0A"
                        stroke="#E8520A"
                        strokeWidth="2"
                        className="cursor-pointer"
                      />
                    );
                  })}
                </svg>
              </div>

              {progress?.total_time_found_ms != null && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-background-elevated px-3 py-2 text-sm">
                  <span className="text-foreground-secondary">Time found</span>
                  <span className="font-mono tabular-nums text-accent-green">
                    {(progress.total_time_found_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
            </section>

            {/* Stats Row */}
            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {history?.sessions?.length ?? '--'}
                </span>
                <span className="text-xs text-foreground-muted">Sessions</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="flex items-center justify-center gap-1">
                  {progress?.total_time_found_ms != null && (
                    <TrendingDown className="h-4 w-4 text-accent-green" />
                  )}
                  <span className="font-mono text-2xl font-semibold tabular-nums text-accent-green">
                    {progress?.total_time_found_ms != null
                      ? `${(progress.total_time_found_ms / 1000).toFixed(1)}s`
                      : '--'}
                  </span>
                </span>
                <span className="text-xs text-foreground-muted">Time found</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {efficacy?.adoption_rate != null
                    ? `${Math.round(efficacy.adoption_rate * 100)}%`
                    : '--'}
                </span>
                <span className="text-xs text-foreground-muted">Applied</span>
              </div>
            </section>

            {/* Efficacy Section — only show when there's meaningful data */}
            {efficacy && (efficacy.avg_delta_by_status?.applied != null || efficacy.avg_delta_by_status?.skipped != null) && (
              <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Did the changes help?</h3>

                <div className="flex flex-col gap-3">
                  {efficacy.avg_delta_by_status?.applied != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Changes applied</span>
                      <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                        <TrendingDown className="h-3 w-3" />
                        {`avg ${(Math.abs(efficacy.avg_delta_by_status.applied) / 1000).toFixed(1)}s / session`}
                      </span>
                    </div>
                  )}
                  {efficacy.avg_delta_by_status?.skipped != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Changes skipped</span>
                      <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-foreground-muted">
                        <TrendingDown className="h-3 w-3" />
                        {`avg ${(Math.abs(efficacy.avg_delta_by_status.skipped) / 1000).toFixed(1)}s / session`}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Best Laps per Track */}
            {bestLapTracks.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-medium text-foreground-secondary">Best Laps by Track</h3>
                <div className="flex flex-col gap-3">
                  {bestLapTracks.map((track) => (
                    <div
                      key={track.name}
                      className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-foreground-muted" />
                          <span className="font-medium text-foreground">{track.name}</span>
                          {track.config && (
                            <span className="text-xs text-foreground-muted">{track.config}</span>
                          )}
                        </div>
                        <span className="mt-1 block text-xs text-foreground-muted">{track.date}</span>
                      </div>
                      <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                        {track.best}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

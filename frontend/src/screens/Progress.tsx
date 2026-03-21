import { useState, useMemo } from 'react';
import { ChevronDown, TrendingDown, TrendingUp, Flag, MapPin, Sparkles, Activity } from 'lucide-react';
import { useLapTrends, useEfficacy, useSessionHistory } from '@/hooks/useProgress';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';

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
        <header className="border-b border-border-subtle bg-background safe-area-top lg:hidden">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[480px] px-4 py-6 lg:max-w-none">
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
        <header className="border-b border-border-subtle bg-background safe-area-top lg:hidden">
          <div className="mx-auto max-w-[480px] px-4 py-6">
            <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          </div>
        </header>
        <main className="mx-auto max-w-[480px] px-4 py-6 lg:max-w-none">
          <ErrorState message="Failed to load progress data." onRetry={() => refetchProgress()} />
        </main>
      </div>
    );
  }

  const hasData = sessions.length > 0;
  const totalTimeFoundRaw = progress?.total_time_found_ms != null
    ? progress.total_time_found_ms
    : null;
  // Show actual value only when meaningful (non-zero or 2+ sessions)
  const totalTimeFoundS = totalTimeFoundRaw != null && (totalTimeFoundRaw !== 0 || sessions.length >= 2)
    ? (totalTimeFoundRaw / 1000).toFixed(1)
    : null;

  // Chart component (shared between mobile and desktop)
  const LapTimeTrendChart = () => (
    <div className="relative h-48 lg:h-44">
      <svg className="h-full w-full" viewBox="0 0 320 160" preserveAspectRatio="none">
        {[0, 40, 80, 120, 160].map((y) => (
          <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
        ))}
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
  );

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      {/* Mobile Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top lg:hidden">
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

      {/* ── Mobile content ── */}
      <main className="mx-auto max-w-[480px] px-4 py-6 lg:hidden">
        {!hasData ? (
          <EmptyState
            title="No progress data yet"
            description="Log track sessions to start seeing your lap time trends and improvement stats."
          />
        ) : (
          <div className="flex flex-col gap-6">
            <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Lap Time Trend</h3>
              <LapTimeTrendChart />
              {sessions.length === 1 && (
                <p className="mt-4 text-center text-sm text-foreground-muted">Add more sessions to see trends</p>
              )}
              {totalTimeFoundS && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-background-elevated px-3 py-2 text-sm">
                  <span className="text-foreground-secondary">Time found</span>
                  <span className="font-mono tabular-nums text-accent-green">{totalTimeFoundS}s</span>
                </div>
              )}
            </section>

            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {history?.sessions?.length ?? '--'}
                </span>
                <span className="text-xs text-foreground-muted">Sessions</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="flex items-center justify-center gap-1">
                  {totalTimeFoundS && <TrendingDown className="h-4 w-4 text-accent-green" />}
                  <span className="font-mono text-2xl font-semibold tabular-nums text-accent-green">
                    {totalTimeFoundS ? `${totalTimeFoundS}s` : '—'}
                  </span>
                </span>
                <span className="text-xs text-foreground-muted">Time found</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {efficacy?.adoption_rate != null && efficacy.adoption_rate > 0
                    ? `${Math.round(efficacy.adoption_rate * 100)}%`
                    : '—'}
                </span>
                <span className="text-xs text-foreground-muted">Applied</span>
              </div>
            </section>

            {efficacy && (efficacy.avg_delta_by_status?.applied != null || efficacy.avg_delta_by_status?.skipped != null) && (
              <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Did the changes help?</h3>
                <div className="flex flex-col gap-3">
                  {efficacy.avg_delta_by_status?.applied != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Changes applied</span>
                      <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                        <TrendingDown className="h-3 w-3" />
                        avg {(Math.abs(efficacy.avg_delta_by_status.applied) / 1000).toFixed(1)}s / session
                      </span>
                    </div>
                  )}
                  {efficacy.avg_delta_by_status?.skipped != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Changes skipped</span>
                      <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-foreground-muted">
                        <TrendingDown className="h-3 w-3" />
                        avg {(Math.abs(efficacy.avg_delta_by_status.skipped) / 1000).toFixed(1)}s / session
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

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

      {/* ── Desktop layout ── */}
      <div className="hidden lg:flex lg:h-[calc(100vh-4rem)] lg:-mx-6 lg:-mt-4 lg:flex-col">
        {/* Desktop header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-background-surface px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">Progress</h1>
          </div>
          {totalTimeFoundS != null && (
            <div className="flex items-center gap-2 text-sm text-foreground-secondary">
              <TrendingDown className="h-4 w-4 text-accent-green" />
              <span>{totalTimeFoundS}s found</span>
            </div>
          )}
        </header>

        {!hasData ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="No progress data yet"
              description="Log track sessions to start seeing your lap time trends."
            />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-5">
              {/* Stat cards row */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Sessions', value: String(history?.sessions?.length ?? '—'), color: '' },
                  { label: 'Time Found', value: totalTimeFoundS ? `${totalTimeFoundS}s` : '—', color: 'text-accent-green' },
                  { label: 'Best Lap', value: progress?.best_laps_by_track?.[0] ? formatLapTime(progress.best_laps_by_track[0].best_lap_ms) : '—', color: '' },
                  { label: 'Adoption', value: efficacy?.adoption_rate != null && efficacy.adoption_rate > 0 ? `${Math.round(efficacy.adoption_rate * 100)}%` : '—', color: '' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border-subtle bg-background-surface p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted mb-1">{stat.label}</p>
                    <p className={cn('font-mono text-2xl font-semibold tabular-nums', stat.color || 'text-foreground')}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Lap time trend (large) */}
              <div className="rounded-lg border border-border-subtle bg-background-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Lap Time Trend</h3>
                </div>
                <LapTimeTrendChart />
                {sessions.length === 1 && (
                  <p className="mt-3 text-center text-sm text-foreground-muted">Add more sessions to see trends</p>
                )}
                {totalTimeFoundS && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-background-elevated px-3 py-2 text-sm">
                    <span className="text-foreground-secondary">Total time found</span>
                    <span className="font-mono font-semibold tabular-nums text-accent-green">{totalTimeFoundS}s</span>
                  </div>
                )}
              </div>

              {/* Bottom row: efficacy + tracks */}
              <div className="grid grid-cols-2 gap-5">
                {/* Efficacy */}
                <div className="rounded-lg border border-border-subtle bg-background-surface p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">Setup Change Efficacy</h3>
                  <div className="flex flex-col gap-2.5">
                    {efficacy?.avg_delta_by_status?.applied != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-secondary">When changes applied</span>
                        <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                          <TrendingDown className="h-3 w-3" />
                          avg {(Math.abs(efficacy.avg_delta_by_status.applied) / 1000).toFixed(1)}s / session
                        </span>
                      </div>
                    )}
                    {efficacy?.avg_delta_by_status?.skipped != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground-secondary">When changes skipped</span>
                        <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-foreground-muted">
                          <TrendingDown className="h-3 w-3" />
                          avg {(Math.abs(efficacy.avg_delta_by_status.skipped) / 1000).toFixed(1)}s / session
                        </span>
                      </div>
                    )}
                    {!efficacy?.avg_delta_by_status?.applied && !efficacy?.avg_delta_by_status?.skipped && (
                      <p className="text-sm text-foreground-muted italic">No efficacy data yet</p>
                    )}
                  </div>
                </div>

                {/* Best laps by track */}
                <div className="rounded-lg border border-border-subtle bg-background-surface p-5">
                  <h3 className="mb-4 text-sm font-semibold text-foreground">Best Laps by Track</h3>
                  {bestLapTracks.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {bestLapTracks.map((track) => (
                        <div
                          key={track.name}
                          className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated p-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Flag className="h-4 w-4 text-foreground-muted" />
                              <span className="font-medium text-foreground">{track.name}</span>
                            </div>
                            <span className="mt-1 block text-xs text-foreground-muted">{track.date}</span>
                          </div>
                          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                            {track.best}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-muted italic">No track data yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right panel: AI insights */}
            <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border-subtle bg-background-surface">
              <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
                <Sparkles className="h-4 w-4 text-accent-orange" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">AI Insights</h2>
              </div>
              <div className="flex flex-col gap-4 p-4">
                {/* Session deltas */}
                {history?.sessions && history.sessions.length > 1 && (
                  <div className="rounded-lg border border-border-subtle bg-background p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                      Session Deltas
                    </p>
                    <div className="flex flex-col gap-2">
                      {sessions.slice(1).map((s, i) => {
                        const delta = sessions[i].time - s.time;
                        const improved = delta > 0;
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-foreground-secondary">{s.date}</span>
                            <span className={cn(
                              'flex items-center gap-1 font-mono tabular-nums',
                              improved ? 'text-accent-green' : 'text-accent-red'
                            )}>
                              {improved ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                              {improved ? '-' : '+'}{Math.abs(delta).toFixed(3)}s
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Summary insight */}
                {hasData && (
                  <div className="rounded-lg border border-border-subtle bg-background p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-accent-orange" />
                      <span className="text-sm font-medium text-foreground">Trend Analysis</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground-secondary">
                      {totalTimeFoundS
                        ? `You've found ${totalTimeFoundS}s over ${sessions.length} sessions. Keep tracking to see detailed insights.`
                        : 'Log more sessions to see trend analysis.'}
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

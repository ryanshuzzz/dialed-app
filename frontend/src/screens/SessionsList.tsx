import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Timer, TrendingDown, Sparkles } from 'lucide-react'
import { useSessions, useSession, useChangeLog } from '@/hooks/useSessions'
import { useSuggestions } from '@/hooks/useSuggestions'
import { useEvent } from '@/hooks/useEvents'
import { useTrack } from '@/hooks/useTracks'
import { useBikes } from '@/hooks/useBikes'
import { useEvents } from '@/hooks/useEvents'
import { useTracks } from '@/hooks/useTracks'
import { SessionCard, type SessionType } from '@/components/common/SessionCard'
import { LapSparkline } from '@/components/common/LapSparkline'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(3)
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, '0')}` : `${seconds}s`
}

// Desktop detail panel showing selected session overview
function DesktopDetailPanel({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading } = useSession(sessionId)
  const { data: changeLog } = useChangeLog(sessionId)
  const { data: suggestions } = useSuggestions(sessionId)
  const [activeTab, setActiveTab] = useState<'overview' | 'suggestion' | 'changes'>('overview')

  if (isLoading || !session) {
    return (
      <div className="flex flex-1 items-center justify-center text-foreground-muted">
        <p className="text-sm">Loading session...</p>
      </div>
    )
  }

  // Resolve track name via event
  const { data: event } = useEvent(session?.event_id)
  const { data: track } = useTrack(event?.track_id ?? undefined)
  const trackLabel = track ? (track.config ? `${track.name} ${track.config}` : track.name) : null

  const bestLap = session.csv_best_lap_ms ?? session.manual_best_lap_ms
  const sessionType = session.session_type
  const snapshot = session.snapshots?.[0]?.settings
  const front = snapshot?.front
  const rear = snapshot?.rear
  const changes = changeLog ?? session.changes ?? []
  const suggestionsCount = suggestions?.length ?? 0
  const changesCount = changes.length

  const typeStyles: Record<string, string> = {
    qualifying: 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow',
    practice: 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue',
    race: 'border-accent-red/30 bg-accent-red/10 text-accent-red',
    trackday: 'border-foreground-muted/30 bg-foreground-muted/10 text-foreground-secondary',
  }
  const typeStyle = typeStyles[sessionType] ?? typeStyles.trackday

  const tabs = [
    { value: 'overview' as const, label: 'Overview', count: null as number | null },
    { value: 'suggestion' as const, label: 'AI Suggestions', count: suggestionsCount },
    { value: 'changes' as const, label: 'Setup Changes', count: changesCount },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Detail header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-background px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]', typeStyle)}>
              {sessionType}
            </span>
            <span className="text-sm text-foreground-secondary">
              {new Date(session.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          {trackLabel && (
            <p className="mt-0.5 text-sm font-medium text-foreground">{trackLabel}</p>
          )}
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {bestLap != null ? formatLapTime(bestLap) : '--:--.---'}
            </span>
          </div>
          {/* Conditions pills */}
          {event?.conditions && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {event.conditions.condition && (
                <span className="rounded-full border border-border-subtle bg-background-elevated px-2 py-0.5 text-[10px] font-medium uppercase text-foreground-secondary">
                  {event.conditions.condition}
                </span>
              )}
              {event.conditions.temp_c != null && (
                <span className="rounded-full border border-border-subtle bg-background-elevated px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
                  {event.conditions.temp_c}°C air
                </span>
              )}
              {event.conditions.track_temp_c != null && (
                <span className="rounded-full border border-border-subtle bg-background-elevated px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
                  {event.conditions.track_temp_c}°C track
                </span>
              )}
              {event.conditions.humidity_pct != null && (
                <span className="rounded-full border border-border-subtle bg-background-elevated px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
                  {event.conditions.humidity_pct}% humidity
                </span>
              )}
            </div>
          )}
        </div>
        <Link to={`/sessions/${sessionId}`}>
          <Button variant="outline" className="h-8 gap-1.5 border-border text-sm text-foreground hover:bg-background-elevated">
            View Full Detail
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border-subtle bg-background px-6">
        {tabs.map((tab) => {
          const isEmpty = tab.count !== null && tab.count === 0
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'relative py-3 px-1 mr-6 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'text-accent-orange'
                  : isEmpty
                    ? 'text-foreground-muted/50 hover:text-foreground-muted'
                    : 'text-foreground-muted hover:text-foreground-secondary'
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={cn(
                  'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none',
                  isEmpty
                    ? 'bg-background-elevated text-foreground-muted/50'
                    : 'bg-accent-orange/15 text-accent-orange'
                )}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-orange" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-5">
            {/* Setup + Feedback row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Setup Snapshot */}
              {(front || rear) && (
                <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Setup Snapshot</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                    {front && (
                      <div>
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Front</p>
                        {front.spring_rate_nmm != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Spring</span>
                            <span className="font-mono tabular-nums text-foreground">{front.spring_rate_nmm}</span>
                          </div>
                        )}
                        {front.compression_clicks != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Comp</span>
                            <span className="font-mono tabular-nums text-foreground">{front.compression_clicks}</span>
                          </div>
                        )}
                        {front.rebound_clicks != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Rebound</span>
                            <span className="font-mono tabular-nums text-foreground">{front.rebound_clicks}</span>
                          </div>
                        )}
                        {front.preload_turns != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Preload</span>
                            <span className="font-mono tabular-nums text-foreground">{front.preload_turns}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {rear && (
                      <div>
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Rear</p>
                        {rear.spring_rate_nmm != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Spring</span>
                            <span className="font-mono tabular-nums text-foreground">{rear.spring_rate_nmm}</span>
                          </div>
                        )}
                        {rear.compression_clicks != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Comp</span>
                            <span className="font-mono tabular-nums text-foreground">{rear.compression_clicks}</span>
                          </div>
                        )}
                        {rear.rebound_clicks != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Rebound</span>
                            <span className="font-mono tabular-nums text-foreground">{rear.rebound_clicks}</span>
                          </div>
                        )}
                        {rear.preload_turns != null && (
                          <div className="flex items-center justify-between py-1 text-sm">
                            <span className="text-foreground-secondary">Preload</span>
                            <span className="font-mono tabular-nums text-foreground">{rear.preload_turns}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rider Feedback */}
              <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Rider Feedback</h3>
                {session.rider_feedback ? (
                  <blockquote className="border-l-2 border-border pl-3 text-sm italic leading-relaxed text-foreground-secondary">
                    {session.rider_feedback}
                  </blockquote>
                ) : (
                  <p className="text-sm text-foreground-muted italic">No feedback recorded</p>
                )}
              </div>
            </div>

            {/* Tire Info */}
            {(session.tire_front || session.tire_rear) && (
              <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Tires</h3>
                <div className="flex flex-wrap gap-2">
                  {session.tire_front?.compound && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-3 py-1 text-xs font-medium text-accent-blue">
                      <span className="text-[10px] text-accent-blue/70">F</span>
                      {session.tire_front.compound}
                      {session.tire_front.pressure_kpa != null && (
                        <span className="text-accent-blue/70">{session.tire_front.pressure_kpa} kPa</span>
                      )}
                    </span>
                  )}
                  {session.tire_rear?.compound && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-orange/30 bg-accent-orange/10 px-3 py-1 text-xs font-medium text-accent-orange">
                      <span className="text-[10px] text-accent-orange/70">R</span>
                      {session.tire_rear.compound}
                      {session.tire_rear.pressure_kpa != null && (
                        <span className="text-accent-orange/70">{session.tire_rear.pressure_kpa} kPa</span>
                      )}
                    </span>
                  )}
                  {session.tire_front?.laps != null && (
                    <span className="rounded-full border border-border-subtle bg-background-elevated px-2 py-0.5 text-[10px] text-foreground-muted">
                      F: {session.tire_front.laps} laps
                    </span>
                  )}
                  {session.tire_rear?.laps != null && (
                    <span className="rounded-full border border-border-subtle bg-background-elevated px-2 py-0.5 text-[10px] text-foreground-muted">
                      R: {session.tire_rear.laps} laps
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Compact Change Log */}
            {changes.length > 0 && (
              <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Setup Changes</h3>
                <div className="flex flex-col gap-2">
                  {changes.map((change) => (
                    <div key={change.id} className="flex items-start gap-2">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-orange" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-foreground">{change.parameter}</span>
                          <span className="font-mono text-xs tabular-nums text-foreground-secondary">
                            {change.from_value ?? '?'} → {change.to_value}
                          </span>
                          <span className="ml-auto text-[10px] text-foreground-muted shrink-0">
                            {new Date(change.applied_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        {change.rationale && (
                          <p className="text-xs text-foreground-muted mt-0.5 truncate">{change.rationale}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'suggestion' && (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
            <Sparkles className="mb-3 h-8 w-8" />
            <p className="text-sm">View full session detail for AI suggestions</p>
            <Link to={`/sessions/${sessionId}`} className="mt-2 text-sm text-accent-orange hover:underline">
              Open Session →
            </Link>
          </div>
        )}

        {activeTab === 'changes' && (
          <div className="flex flex-col gap-3">
            {changes.length > 0 ? (
              changes.map((change) => (
                <div key={change.id} className="rounded-lg border border-border-subtle bg-background-surface p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-foreground">{change.parameter}</span>
                    <span className="text-xs text-foreground-muted">
                      {new Date(change.applied_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-mono text-sm tabular-nums text-foreground-secondary">
                    {change.from_value ?? '?'} → {change.to_value}
                  </p>
                  {change.rationale && (
                    <p className="mt-2 text-sm text-foreground-secondary">{change.rationale}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-foreground-muted">No changes recorded</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SessionsList() {
  const { data: apiSessions } = useSessions()
  const { data: bikes } = useBikes()
  const { data: events } = useEvents()
  const { data: tracks } = useTracks()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Build lookup maps for resolving track names from session -> event -> track
  const trackMap = useMemo(() => {
    const map = new Map<string, string>()
    if (tracks) {
      for (const t of tracks) {
        map.set(t.id, t.config ? `${t.name} ${t.config}` : t.name)
      }
    }
    return map
  }, [tracks])

  const sessionTrackMap = useMemo(() => {
    const map = new Map<string, string>()
    if (events) {
      for (const e of events) {
        if (e.track_id) {
          const name = trackMap.get(e.track_id)
          if (name) map.set(e.id, name)
        }
      }
    }
    return map
  }, [events, trackMap])

  const sessions = useMemo(() => {
    if (!apiSessions || apiSessions.length === 0) return []
    return apiSessions.map((s) => {
      const bestMs = s.csv_best_lap_ms ?? s.manual_best_lap_ms
      return {
        id: s.id,
        type: s.session_type.toUpperCase() as SessionType,
        bestLap: bestMs != null ? formatLapTime(bestMs) : '--:--.---',
        bestLapMs: bestMs,
        date: new Date(s.created_at).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        time: new Date(s.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        trackName: sessionTrackMap.get(s.event_id),
      }
    })
  }, [apiSessions, sessionTrackMap])

  // Auto-select first session on desktop when none selected
  const effectiveSelectedId = selectedSessionId ?? sessions[0]?.id ?? null

  // Compute best lap from real session data
  const bestLapMs = useMemo(() => {
    if (!apiSessions || apiSessions.length === 0) return null
    const times = apiSessions
      .map((s) => s.csv_best_lap_ms ?? s.manual_best_lap_ms)
      .filter((t): t is number => t != null)
    return times.length > 0 ? Math.min(...times) : null
  }, [apiSessions])

  const lapTimesInSeconds = useMemo(() => {
    if (!apiSessions || apiSessions.length === 0) return []
    return apiSessions
      .map((s) => s.csv_best_lap_ms ?? s.manual_best_lap_ms)
      .filter((t): t is number => t != null)
      .map((ms) => ms / 1000)
  }, [apiSessions])

  // Use first bike from the garage as the active bike name
  const activeBike = bikes && bikes.length > 0 ? bikes[0] : null
  const bikeName = activeBike
    ? `${activeBike.year ? `${activeBike.year} ` : ''}${activeBike.make} ${activeBike.model}`.trim()
    : null

  const typeStyles: Record<string, string> = {
    QUALIFYING: 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow',
    PRACTICE: 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue',
    RACE: 'border-accent-red/30 bg-accent-red/10 text-accent-red',
    TRACKDAY: 'border-foreground-muted/30 bg-foreground-muted/10 text-foreground-secondary',
  }

  return (
    <>
      {/* ── Mobile view ── */}
      <div className="pb-8 lg:hidden">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            {bikeName && (
              <h1 className="text-lg font-semibold text-foreground">{bikeName}</h1>
            )}
          </div>
          <Link to="/sessions/new">
            <Button className="h-9 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover">
              <Plus className="h-4 w-4" />
              New Session
            </Button>
          </Link>
        </div>

        {/* Session List */}
        {sessions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} {...session} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Log your first track session to start tracking your progress."
          />
        )}

        {/* Bottom Summary Bar */}
        {sessions.length > 0 && (
          <div className="fixed bottom-[68px] left-0 right-0 z-40 border-t border-border-subtle bg-background-surface lg:hidden">
            <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-foreground-muted" />
                <span className="text-sm text-foreground-secondary">Best lap this weekend:</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {bestLapMs != null ? formatLapTime(bestLapMs) : '--'}
                </span>
              </div>
              <LapSparkline times={lapTimesInSeconds} />
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop view: two-column layout ── */}
      <div className="hidden lg:flex lg:h-[calc(100vh-4rem)] lg:-mx-6 lg:-mt-4 lg:flex-col">
        {/* Desktop top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-background-surface px-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                {bikeName ?? 'Sessions'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {bestLapMs != null && (
              <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background-elevated px-3 py-1.5">
                <Timer className="h-4 w-4 text-foreground-muted" />
                <span className="text-xs text-foreground-secondary">Weekend best:</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatLapTime(bestLapMs)}
                </span>
                <TrendingDown className="h-3 w-3 text-accent-green" />
                <LapSparkline times={lapTimesInSeconds} />
              </div>
            )}
            <Link to="/sessions/new">
              <Button className="h-8 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover">
                <Plus className="h-3.5 w-3.5" />
                New Session
              </Button>
            </Link>
          </div>
        </header>

        {/* Desktop body: two columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: session list */}
          <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-background-surface">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Sessions</span>
              <span className="rounded bg-background-elevated px-1.5 py-0.5 text-[10px] font-mono text-foreground-secondary">
                {sessions.length}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                    effectiveSelectedId === session.id
                      ? 'border-accent-orange/30 bg-accent-orange/5'
                      : 'border-transparent hover:border-border-subtle hover:bg-background-elevated'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      typeStyles[session.type] ?? typeStyles.PRACTICE
                    )}>
                      {session.type}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {session.bestLap}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">{session.date} · {session.time}</span>
                  </div>
                  {session.trackName && (
                    <div className="mt-1 text-xs text-foreground-muted">{session.trackName}</div>
                  )}
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="py-8 text-center text-sm text-foreground-muted">
                  No sessions yet
                </div>
              )}
            </div>
          </aside>

          {/* Right: session detail */}
          {effectiveSelectedId ? (
            <DesktopDetailPanel sessionId={effectiveSelectedId} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-foreground-muted">
              <p className="text-sm">Select a session to view details</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

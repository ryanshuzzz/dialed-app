import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Timer } from 'lucide-react'
import { useSessions } from '@/hooks/useSessions'
import { useBikes } from '@/hooks/useBikes'
import { useEvents } from '@/hooks/useEvents'
import { useTracks } from '@/hooks/useTracks'
import { SessionCard, type SessionType } from '@/components/common/SessionCard'
import { LapSparkline } from '@/components/common/LapSparkline'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(3)
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, '0')}` : `${seconds}s`
}

export default function SessionsList() {
  const { data: apiSessions } = useSessions()
  const { data: bikes } = useBikes()
  const { data: events } = useEvents()
  const { data: tracks } = useTracks()

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

  return (
    <div className="pb-8">
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

      {/* Bottom Summary Bar — only shown when there are sessions */}
      {sessions.length > 0 && (
        <div className="fixed bottom-[68px] left-0 right-0 z-40 border-t border-border-subtle bg-background-surface">
          <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-foreground-muted" />
              <span className="text-sm text-foreground-secondary">
                Best lap this weekend:
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {bestLapMs != null ? formatLapTime(bestLapMs) : '--'}
              </span>
            </div>
            <LapSparkline times={lapTimesInSeconds} />
          </div>
        </div>
      )}
    </div>
  )
}

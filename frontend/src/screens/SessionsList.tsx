import { Link } from 'react-router-dom'
import { Plus, Timer } from 'lucide-react'
import { useSessions } from '@/hooks/useSessions'
import { SessionCard, type SessionType } from '@/components/common/SessionCard'
import { LapSparkline } from '@/components/common/LapSparkline'
import { Button } from '@/components/ui/button'

// Fallback mock data used when API returns no sessions
const mockSessions: {
  id: string
  type: SessionType
  bestLap: string
  delta?: { value: number; improved: boolean }
  date: string
  time: string
  hasAiSuggestion?: boolean
  hasTelemetry?: boolean
}[] = [
  {
    id: 'qp6',
    type: 'QUALIFYING',
    bestLap: '1:45.972',
    delta: { value: 0.4, improved: true },
    date: 'Sat Mar 7',
    time: '9:57 AM',
    hasAiSuggestion: true,
    hasTelemetry: true,
  },
  {
    id: 'qp5',
    type: 'QUALIFYING',
    bestLap: '1:46.366',
    delta: { value: 2.2, improved: true },
    date: 'Sat Mar 7',
    time: '8:15 AM',
    hasTelemetry: true,
  },
  {
    id: 'p3',
    type: 'PRACTICE',
    bestLap: '1:48.568',
    delta: { value: 0.8, improved: true },
    date: 'Fri Mar 6',
    time: '4:30 PM',
    hasTelemetry: true,
  },
  {
    id: 'p2',
    type: 'PRACTICE',
    bestLap: '1:49.372',
    delta: { value: 1.5, improved: true },
    date: 'Fri Mar 6',
    time: '2:00 PM',
  },
  {
    id: 'p1',
    type: 'PRACTICE',
    bestLap: '1:50.892',
    date: 'Fri Mar 6',
    time: '10:00 AM',
  },
]

const lapTimesInSeconds = [110.892, 109.372, 108.568, 106.366, 105.972]

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(3)
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, '0')}` : `${seconds}s`
}

export default function SessionsList() {
  const { data: apiSessions } = useSessions()

  // Map API sessions to card format, or fall back to mock data
  const sessions = apiSessions && apiSessions.length > 0
    ? apiSessions.map((s) => {
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
        }
      })
    : mockSessions

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold text-foreground">
            2021 Honda CBR1000RR-R SP
          </h1>
          <p className="text-sm text-foreground-secondary">
            Buttonwillow Raceway · CRA 2026 Round 1
          </p>
        </div>
        <Link to="/sessions/new">
          <Button className="h-9 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover">
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        </Link>
      </div>

      {/* Session List */}
      <div className="flex flex-col gap-3">
        {sessions.map((session) => (
          <SessionCard key={session.id} {...session} />
        ))}
      </div>

      {/* Bottom Summary Bar */}
      <div className="fixed bottom-[68px] left-0 right-0 z-40 border-t border-border-subtle bg-background-surface">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-foreground-muted" />
            <span className="text-sm text-foreground-secondary">
              Best lap this weekend:
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              1:45.972
            </span>
          </div>
          <LapSparkline times={lapTimesInSeconds} />
        </div>
      </div>
    </div>
  )
}

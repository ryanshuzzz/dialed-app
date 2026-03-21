import { Link } from 'react-router-dom'
import { ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SessionType = 'QUALIFYING' | 'PRACTICE' | 'RACE' | 'TRACKDAY'

interface SessionCardProps {
  id: string
  type: SessionType
  bestLap: string
  delta?: {
    value: number
    improved: boolean
  }
  date: string
  time: string
  trackName?: string
  hasAiSuggestion?: boolean
  hasTelemetry?: boolean
}

const typeStyles: Record<SessionType, string> = {
  QUALIFYING: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30',
  PRACTICE: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  RACE: 'bg-accent-red/10 text-accent-red border-accent-red/30',
  TRACKDAY: 'bg-foreground-muted/10 text-foreground-secondary border-foreground-muted/30',
}

export function SessionCard({
  id,
  type,
  bestLap,
  delta,
  date,
  time,
  trackName,
  hasAiSuggestion,
  hasTelemetry,
}: SessionCardProps) {
  return (
    <Link to={`/sessions/${id}`}>
      <div className="group relative flex items-center gap-4 rounded-lg border border-border-subtle bg-background-surface p-4 transition-colors hover:border-border active:bg-background-elevated">
        {/* Indicators */}
        <div className="absolute right-12 top-4 flex gap-1.5">
          {hasAiSuggestion && (
            <span className="h-2 w-2 rounded-full bg-accent-orange" title="AI suggestion available" />
          )}
          {hasTelemetry && (
            <span className="h-2 w-2 rounded-full bg-accent-blue" title="Telemetry uploaded" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          {/* Session type badge */}
          <span className={cn(
            'inline-flex w-fit rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
            typeStyles[type]
          )}>
            {type}
          </span>

          {/* Track name */}
          {trackName && (
            <span className="text-sm font-medium text-foreground-secondary">
              {trackName}
            </span>
          )}

          {/* Lap time and delta */}
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {bestLap}
            </span>
            {delta && (
              <span className={cn(
                'flex items-center gap-0.5 font-mono text-sm font-medium tabular-nums',
                delta.improved ? 'text-accent-green' : 'text-accent-red'
              )}>
                {delta.improved ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5" />
                )}
                {delta.improved ? '-' : '+'}{Math.abs(delta.value).toFixed(1)}s
              </span>
            )}
          </div>

          {/* Date and time */}
          <span className="text-sm text-foreground-secondary">
            {date} · {time}
          </span>
        </div>

        <ChevronRight className="h-5 w-5 text-foreground-muted transition-colors group-hover:text-foreground-secondary" />
      </div>
    </Link>
  )
}

import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  TrendingDown,
  Plus,
  Check,
  X,
  Pencil,
  Sparkles,
  Star,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession, useChangeLog } from '@/hooks/useSessions'
import { useEvent } from '@/hooks/useEvents'
import { useTrack } from '@/hooks/useTracks'
import {
  useSuggestions,
  useSuggestion,
  useRequestSuggestion,
  useUpdateChangeStatus,
} from '@/hooks/useSuggestions'
import { useChannels, useLapData, useAnalysis } from '@/hooks/useTelemetry'
import { useSSE } from '@/hooks/useSSE'
import { SuggestionStream } from '@/components/session/SuggestionStream'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'

type TabType = 'overview' | 'telemetry' | 'suggestion' | 'changes'

// Mock data for fields not covered by existing hooks
const mockSessionData = {
  frontSettings: {
    spring: 10.75,
    compression: 16,
    rebound: 12,
    preload: 2,
    forkHeight: 8.6,
  },
  rearSettings: {
    spring: 110,
    compression: 12,
    rebound: 15,
    preload: 10,
  },
  changedSettings: [
    { key: 'Front rebound', from: 14, to: 12, unit: 'clicks out' },
  ],
  conditions: { airTemp: 18, condition: 'Dry', frontTire: 'SC1', rearTire: 'SC1' },
  feedback: {
    symptoms: ['Brake-to-throttle chatter'],
    text: 'Front chatters as I release the brake and pick up throttle into T4. Feels like the fork is rebounding too fast.',
  },
  stats: {
    maxSpeed: 155.8,
    forkTravel: 140.4,
    bankAngle: 59.6,
  },
  laps: [
    { number: 1, time: '2:32.836', isOutLap: true },
    { number: 2, time: '1:48.568' },
    { number: 3, time: '1:46.366' },
    { number: 4, time: '1:45.972', isBest: true },
    { number: 5, time: '2:19.256', isInLap: true },
  ],
}

const mockSuggestions = [
  {
    rank: 1,
    setting: 'Front rebound',
    from: 14,
    to: 12,
    change: '2 clicks stiffer',
    confidence: 87,
    symptom: 'Brake-to-throttle chatter',
    reason:
      'Fork rebounding too fast at brake release — front tire losing contact before fully unloading',
    status: 'applied' as const,
  },
  {
    rank: 2,
    setting: 'Rear preload',
    from: 8,
    to: 10,
    change: '2 turns more',
    confidence: 72,
    symptom: 'Weight transfer delay',
    reason:
      'Additional preload will improve initial response and reduce dive during hard braking',
    status: 'pending' as const,
  },
  {
    rank: 3,
    setting: 'Front compression',
    from: 16,
    to: 18,
    change: '2 clicks stiffer',
    confidence: 58,
    symptom: 'Bottoming under hard braking',
    reason: 'Telemetry shows fork approaching full travel in braking zones',
    status: 'pending' as const,
  },
]

const mockChangeHistory = [
  {
    time: '9:47 AM',
    setting: 'Front rebound',
    from: 14,
    to: 12,
    unit: 'clicks out',
    note: 'Addressing brake-to-throttle transition chatter',
    result: { delta: 0.394, improved: true },
    isAi: true,
    type: 'suspension',
  },
]

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(3)
  return minutes > 0 ? `${minutes}:${seconds.padStart(6, '0')}` : `${seconds}s`
}

const typeStyles: Record<string, string> = {
  qualifying: 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow',
  practice: 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue',
  race: 'border-accent-red/30 bg-accent-red/10 text-accent-red',
  trackday: 'border-foreground-muted/30 bg-foreground-muted/10 text-foreground-secondary',
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: session, isLoading, error, refetch } = useSession(id)
  const { data: changeLog } = useChangeLog(id)

  // Track resolution via event
  const { data: sessionEvent } = useEvent(session?.event_id)
  const { data: sessionTrack } = useTrack(sessionEvent?.track_id ?? undefined)
  const trackLabel = sessionTrack ? (sessionTrack.config ? `${sessionTrack.name} ${sessionTrack.config}` : sessionTrack.name) : null

  // Suggestion state
  const { data: suggestions } = useSuggestions(id)
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | undefined>(undefined)
  const { data: activeSuggestion } = useSuggestion(activeSuggestionId)
  const requestSuggestion = useRequestSuggestion()
  const updateChangeStatus = useUpdateChangeStatus()

  // SSE streaming state
  const [streamJobId, setStreamJobId] = useState<string | null>(null)
  const [streamText, setStreamText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  useSSE(streamJobId ? `/suggest/${streamJobId}/stream` : null, {
    onToken: (text) => {
      setStreamText((prev) => prev + text)
    },
    onComplete: (data) => {
      setIsStreaming(false)
      setStreamJobId(null)
      const result = data as Record<string, unknown> | undefined
      if (result?.suggestion) {
        const sug = result.suggestion as { id?: string }
        if (sug.id) {
          setActiveSuggestionId(sug.id)
        }
      }
    },
    onFailed: () => {
      setIsStreaming(false)
      setStreamJobId(null)
    },
  })

  // Telemetry state
  const { data: channelSummary } = useChannels(id)
  const { data: analysis } = useAnalysis(id)
  const totalLaps = analysis?.lap_segments?.length ?? 0
  const [activeChannels, setActiveChannels] = useState<string[]>(['gps_speed', 'throttle_pos'])
  const [selectedLap, setSelectedLap] = useState(1)
  const { data: _lapData } = useLapData(
    totalLaps > 0 ? id : undefined,
    totalLaps > 0 ? selectedLap : undefined,
  )

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [skillLevel, setSkillLevel] = useState<'expert' | 'novice'>('expert')

  const handleRequestSuggestion = useCallback(async () => {
    if (!id) return
    try {
      const result = await requestSuggestion.mutateAsync({ session_id: id })
      setStreamText('')
      setIsStreaming(true)
      setStreamJobId(result.job_id)
    } catch {
      // Error handled by mutation
    }
  }, [id, requestSuggestion])

  const handleApply = useCallback(
    (changeId: string) => {
      if (!activeSuggestionId) return
      updateChangeStatus.mutate({
        suggestionId: activeSuggestionId,
        changeId,
        data: { applied_status: 'applied' },
      })
    },
    [activeSuggestionId, updateChangeStatus],
  )

  const handleSkip = useCallback(
    (changeId: string) => {
      if (!activeSuggestionId) return
      updateChangeStatus.mutate({
        suggestionId: activeSuggestionId,
        changeId,
        data: { applied_status: 'skipped' },
      })
    },
    [activeSuggestionId, updateChangeStatus],
  )

  const handleModify = useCallback(
    (changeId: string, actualValue: string) => {
      if (!activeSuggestionId) return
      updateChangeStatus.mutate({
        suggestionId: activeSuggestionId,
        changeId,
        data: { applied_status: 'applied_modified', actual_value: actualValue },
      })
    },
    [activeSuggestionId, updateChangeStatus],
  )

  // Suppress unused variable warnings
  void activeChannels
  void setActiveChannels
  void channelSummary
  void handleModify

  const suggestionsCount = suggestions?.length ?? 0
  const changesCount = (changeLog ?? session?.changes ?? []).length

  const tabs: { value: TabType; label: string; count: number | null }[] = [
    { value: 'overview', label: 'Overview', count: null },
    { value: 'telemetry', label: 'Telemetry', count: null },
    { value: 'suggestion', label: 'AI Suggestions', count: suggestionsCount },
    { value: 'changes', label: 'Setup Changes', count: changesCount },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="lines" count={4} />
        <LoadingSkeleton variant="cards" count={2} />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div>
        <ErrorState message="Failed to load session." onRetry={() => refetch()} />
        <div className="text-center mt-4">
          <Link to="/" className="text-accent-orange hover:underline text-sm">
            Back to Sessions
          </Link>
        </div>
      </div>
    )
  }

  const bestLap = session.csv_best_lap_ms ?? session.manual_best_lap_ms
  const sessionType = session.session_type
  const typeStyle = typeStyles[sessionType] ?? typeStyles.trackday

  // Use API change log data or session embedded changes, otherwise fall back to mock
  const changes = changeLog ?? session.changes ?? []
  const snapshot = session.snapshots?.[0]?.settings
  const front = snapshot?.front
  const rear = snapshot?.rear
  const hasApiChanges = changes.length > 0

  // Use API suggestions when available
  const hasSuggestionData = (suggestions && suggestions.length > 0) || isStreaming || streamText

  // Use mock laps for telemetry tab (until real lap data from analysis is available)
  const displayLaps = analysis?.lap_segments
    ? analysis.lap_segments.map((seg) => ({
        number: seg.lap_number,
        time: formatLapTime(seg.lap_time_ms),
        isBest: analysis.best_lap?.lap_number === seg.lap_number,
      }))
    : mockSessionData.laps

  return (
    <div className="pb-24 lg:pb-8 lg:max-w-4xl" data-testid="session-detail">
      {/* Header */}
      <div className="mb-2 flex items-start gap-3">
        <Link
          to="/"
          className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                typeStyle,
              )}
              data-testid="session-type-badge"
            >
              {sessionType}
            </span>
            <span className="text-sm text-foreground-secondary">
              {new Date(session.created_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          {trackLabel && (
            <p className="mt-1 text-sm font-medium text-foreground-secondary">{trackLabel}</p>
          )}
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold tabular-nums text-foreground" data-testid="best-lap">
              {bestLap != null ? formatLapTime(bestLap) : '--:--.---'}
            </span>
            <span className="flex items-center gap-1 font-mono text-sm font-medium tabular-nums text-accent-green">
              <TrendingDown className="h-4 w-4" />
              0.394s from last session
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-border-subtle">
        {tabs.map((tab) => {
          const isEmpty = tab.count !== null && tab.count === 0
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'relative flex-1 py-3 text-center text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'text-accent-orange'
                  : isEmpty
                    ? 'text-foreground-muted/50 hover:text-foreground-muted'
                    : 'text-foreground-muted hover:text-foreground-secondary',
              )}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={cn(
                  'ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none',
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* Setup + Feedback — side by side on desktop */}
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-4">
          {/* Setup Snapshot */}
          {(front || rear) && (
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">
              Setup Snapshot
            </h3>
            <div className="grid grid-cols-2 gap-6">
              {/* Front */}
              <div>
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  Front
                </h4>
                <div className="flex flex-col gap-2 text-sm">
                  {front?.spring_rate_nmm != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Spring</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {front.spring_rate_nmm} <span className="text-xs text-foreground-muted font-normal">N/mm</span>
                    </span>
                  </div>
                  )}
                  {front?.compression_clicks != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Comp</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {front.compression_clicks} <span className="text-xs text-foreground-muted font-normal">clicks</span>
                    </span>
                  </div>
                  )}
                  {front?.rebound_clicks != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Rebound</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {front.rebound_clicks} <span className="text-xs text-foreground-muted font-normal">clicks</span>
                    </span>
                  </div>
                  )}
                  {front?.preload_turns != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Preload</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {front.preload_turns} <span className="text-xs text-foreground-muted font-normal">turns</span>
                    </span>
                  </div>
                  )}
                  {front?.fork_height_mm != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Height</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {front.fork_height_mm} <span className="text-xs text-foreground-muted font-normal">mm</span>
                    </span>
                  </div>
                  )}
                </div>
              </div>

              {/* Rear */}
              <div>
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  Rear
                </h4>
                <div className="flex flex-col gap-2 text-sm">
                  {rear?.spring_rate_nmm != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Spring</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {rear.spring_rate_nmm} <span className="text-xs text-foreground-muted font-normal">N/mm</span>
                    </span>
                  </div>
                  )}
                  {rear?.compression_clicks != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Comp</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {rear.compression_clicks} <span className="text-xs text-foreground-muted font-normal">clicks</span>
                    </span>
                  </div>
                  )}
                  {rear?.rebound_clicks != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Rebound</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {rear.rebound_clicks} <span className="text-xs text-foreground-muted font-normal">clicks</span>
                    </span>
                  </div>
                  )}
                  {rear?.preload_turns != null && (
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Preload</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {rear.preload_turns} <span className="text-xs text-foreground-muted font-normal">turns</span>
                    </span>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          {/* Rider Feedback */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-foreground-secondary">
              Rider Feedback
            </h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {(session.rider_feedback
                ? mockSessionData.feedback.symptoms
                : mockSessionData.feedback.symptoms
              ).map((symptom) => (
                <span
                  key={symptom}
                  className="rounded-full border border-accent-orange/30 bg-accent-orange/10 px-3 py-1 text-xs text-accent-orange"
                >
                  {symptom}
                </span>
              ))}
            </div>
            <blockquote
              className="border-l-2 border-border pl-4 text-sm italic text-foreground-secondary"
            >
              {session.rider_feedback ?? mockSessionData.feedback.text}
            </blockquote>
          </section>
          </div>

          {/* Quick Stats — wider grid on desktop */}
          <section className="grid grid-cols-3 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                {mockSessionData.stats.maxSpeed}
              </span>
              <span className="text-xs text-foreground-muted">mph max</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                {mockSessionData.stats.forkTravel}
              </span>
              <span className="text-xs text-foreground-muted">mm fork</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                {mockSessionData.stats.bankAngle}&deg;
              </span>
              <span className="text-xs text-foreground-muted">bank angle</span>
            </div>
          </section>
        </div>
      )}

      {/* Telemetry Tab */}
      {activeTab === 'telemetry' && (
        <div className="flex flex-col gap-6">
          {/* Lap Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {displayLaps.map((lap) => (
              <button
                key={lap.number}
                onClick={() => setSelectedLap(lap.number)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  selectedLap === lap.number
                    ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                    : 'border-border-subtle text-foreground-secondary hover:border-border',
                )}
              >
                Lap {lap.number}
                {lap.isBest && <Star className="h-3 w-3 fill-accent-orange" />}
              </button>
            ))}
          </div>

          {/* Speed Trace Chart */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">
              Speed Trace
            </h3>
            <div className="relative h-40">
              <svg className="h-full w-full" viewBox="0 0 300 120">
                <defs>
                  <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8520A" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#E8520A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 30, 60, 90, 120].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="300"
                    y2={y}
                    stroke="#2A2A2A"
                    strokeWidth="0.5"
                  />
                ))}
                <path
                  d="M0,100 Q50,40 100,60 T200,30 T280,50 L300,60"
                  fill="none"
                  stroke="#F2F2F0"
                  strokeWidth="1.5"
                  opacity="0.4"
                />
                <path
                  d="M0,100 Q50,35 100,55 T200,25 T280,45 L300,55"
                  fill="url(#speedGradient)"
                  stroke="#E8520A"
                  strokeWidth="2"
                />
              </svg>
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-foreground-muted">
                <span>0s</span>
                <span>30s</span>
                <span>60s</span>
                <span>90s</span>
              </div>
            </div>
          </section>

          {/* Fork Travel Chart */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">
              Fork Travel
            </h3>
            <div className="relative h-40">
              <svg className="h-full w-full" viewBox="0 0 300 120">
                {[0, 30, 60, 90, 120].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="300"
                    y2={y}
                    stroke="#2A2A2A"
                    strokeWidth="0.5"
                  />
                ))}
                <rect x="40" y="0" width="30" height="120" fill="#EF4444" opacity="0.1" />
                <rect x="140" y="0" width="25" height="120" fill="#EF4444" opacity="0.1" />
                <rect x="220" y="0" width="20" height="120" fill="#EF4444" opacity="0.1" />
                <rect x="70" y="0" width="15" height="120" fill="#EAB308" opacity="0.1" />
                <rect x="165" y="0" width="15" height="120" fill="#EAB308" opacity="0.1" />
                <path
                  d="M0,80 Q20,80 40,20 Q60,90 85,70 T140,15 Q160,85 180,75 T220,20 Q250,80 280,70 L300,75"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </section>

          {/* Key Metrics */}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
              <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                15.63
              </span>
              <span className="text-xs text-foreground-muted">bar max brake</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
              <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                84.3
              </span>
              <span className="text-xs text-foreground-muted">mm avg @ release</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
              <span className="flex items-center gap-1">
                <span className="font-mono text-lg font-semibold tabular-nums text-accent-yellow">
                  57%
                </span>
              </span>
              <span className="text-xs text-foreground-muted">GRPPCT cap</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
              <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                EB1
              </span>
              <span className="text-xs text-foreground-muted">+ 15/44 gearing</span>
            </div>
          </section>
        </div>
      )}

      {/* Suggestion Tab */}
      {activeTab === 'suggestion' && (
        <div className="flex flex-col gap-6">
          {/* SSE stream output */}
          {(isStreaming || streamText) && (
            <div className="mb-2">
              <SuggestionStream text={streamText} isStreaming={isStreaming} />
            </div>
          )}

          {/* Request suggestion button */}
          {!hasSuggestionData && (
            <div className="text-center py-6">
              <Button
                onClick={handleRequestSuggestion}
                disabled={requestSuggestion.isPending || isStreaming}
                className="gap-2 bg-accent-orange text-white hover:bg-accent-orange-hover"
                data-testid="request-suggestion-button"
              >
                <Sparkles className="h-4 w-4" />
                {requestSuggestion.isPending ? 'Requesting...' : 'Get AI Suggestion'}
              </Button>
            </div>
          )}

          {/* API suggestions list */}
          {suggestions && suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSuggestionId(s.id)}
                  className={cn(
                    'w-full text-left p-3 min-h-[44px] rounded-lg border transition-colors',
                    activeSuggestionId === s.id
                      ? 'border-accent-orange/30 bg-accent-orange/10'
                      : 'border-border-subtle bg-background-surface hover:border-border',
                  )}
                  data-testid="suggestion-summary"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground-muted">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs text-foreground-secondary">
                      {s.applied_count ?? 0}/{s.change_count ?? 0} applied
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">
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
                <div
                  key={change.id}
                  className={cn(
                    'rounded-lg border bg-background-surface p-4',
                    change.applied_status === 'applied'
                      ? 'border-accent-green/30'
                      : 'border-border-subtle',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-foreground">{change.parameter}</span>
                    {change.applied_status === 'applied' && (
                      <span className="flex items-center gap-1 rounded-full bg-accent-green/20 px-2 py-0.5 text-xs text-accent-green">
                        <Check className="h-3 w-3" />
                        Applied
                      </span>
                    )}
                  </div>
                  <div className="mb-2 font-mono text-sm tabular-nums text-foreground">
                    {change.suggested_value}
                  </div>
                  {change.confidence != null && (
                    <div className="mb-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border-subtle">
                        <div
                          className="h-full bg-accent-orange"
                          style={{ width: `${change.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-foreground-muted">
                        {change.confidence}%
                      </span>
                    </div>
                  )}
                  {change.symptom && (
                    <p className="text-sm text-foreground-secondary">{change.symptom}</p>
                  )}
                  {change.applied_status === 'not_applied' && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApply(change.id)}
                        className="gap-1 bg-accent-orange text-white hover:bg-accent-orange-hover"
                      >
                        <Check className="h-3 w-3" />
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSkip(change.id)}
                        className="gap-1 border-border text-foreground"
                      >
                        <X className="h-3 w-3" />
                        Skip
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Mock AI Analysis (shown when no real suggestion data yet) */}
          {!hasSuggestionData && (
            <>
              <section className="rounded-lg border border-accent-orange/30 bg-gradient-to-b from-accent-orange/10 to-transparent p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent-orange" />
                  <span className="font-medium text-foreground">AI Analysis</span>
                  <span className="ml-auto text-xs text-foreground-muted">
                    Viewing as:{' '}
                    <button
                      onClick={() =>
                        setSkillLevel(skillLevel === 'expert' ? 'novice' : 'expert')
                      }
                      className="ml-1 text-accent-orange hover:underline"
                    >
                      {skillLevel === 'expert' ? 'Expert' : 'Novice'}
                    </button>
                  </span>
                </div>
                <div className="space-y-3 text-sm text-foreground-secondary">
                  {skillLevel === 'expert' ? (
                    <>
                      <p>
                        The 2-click rebound change to 12 clicks out is the right call. Your
                        telemetry shows the fork extending at roughly 14mm/s at brake release.
                        Stiffer rebound slows that extension, giving the tire time to load
                        progressively.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        Your front suspension is bouncing back too fast when you let go of the
                        brakes. By slowing down how fast the fork extends (2 clicks stiffer), the
                        tire stays in better contact with the track.
                      </p>
                    </>
                  )}
                </div>
              </section>

              {/* Mock Recommendation Cards */}
              {mockSuggestions.map((suggestion) => (
                <div
                  key={suggestion.rank}
                  className={cn(
                    'rounded-lg border bg-background-surface p-4',
                    suggestion.status === 'applied'
                      ? 'border-accent-green/30'
                      : 'border-border-subtle',
                  )}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-orange/20 text-xs font-semibold text-accent-orange">
                        {suggestion.rank}
                      </span>
                      <span className="font-medium text-foreground">{suggestion.setting}</span>
                    </div>
                    {suggestion.status === 'applied' && (
                      <span className="flex items-center gap-1 rounded-full bg-accent-green/20 px-2 py-0.5 text-xs text-accent-green">
                        <Check className="h-3 w-3" />
                        Applied
                      </span>
                    )}
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-mono text-lg tabular-nums text-foreground">
                      {suggestion.from} &rarr; {suggestion.to}
                    </span>
                    <span className="text-sm text-foreground-secondary">
                      ({suggestion.change})
                    </span>
                  </div>

                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-border-subtle">
                      <div
                        className="h-full bg-accent-orange"
                        style={{ width: `${suggestion.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-foreground-muted">
                      {suggestion.confidence}%
                    </span>
                  </div>

                  <div className="mb-3 border-t border-border-subtle pt-3">
                    <p className="mb-1 text-xs text-foreground-muted">Symptom</p>
                    <p className="text-sm text-foreground">{suggestion.symptom}</p>
                  </div>

                  <p className="text-sm text-foreground-secondary">{suggestion.reason}</p>

                  {suggestion.status !== 'applied' && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1 bg-accent-orange text-white hover:bg-accent-orange-hover"
                      >
                        <Check className="h-3 w-3" />
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-border text-foreground"
                      >
                        <X className="h-3 w-3" />
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-border text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                        Modify
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Changes Tab */}
      {activeTab === 'changes' && (
        <div className="flex flex-col gap-4">
          {hasApiChanges ? (
            changes.map((change) => (
              <div key={change.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-accent-orange" />
                  <div className="w-0.5 flex-1 bg-border-subtle" />
                </div>
                <div className="flex-1 pb-6">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs text-foreground-muted">
                      {new Date(change.applied_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">
                    {change.parameter}: {change.from_value ?? '?'} &rarr; {change.to_value}
                  </p>
                  {change.rationale && (
                    <p className="mt-1 text-sm text-foreground-secondary">
                      &ldquo;{change.rationale}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : mockChangeHistory.length > 0 ? (
            mockChangeHistory.map((change, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      change.type === 'suspension' ? 'bg-accent-orange' : 'bg-accent-blue',
                    )}
                  />
                  <div className="w-0.5 flex-1 bg-border-subtle" />
                </div>
                <div className="flex-1 pb-6">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs text-foreground-muted">{change.time}</span>
                    {change.isAi && (
                      <span className="rounded bg-accent-orange/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-orange">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-foreground">
                    {change.setting} {change.from} &rarr; {change.to} {change.unit}
                  </p>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    &ldquo;{change.note}&rdquo;
                  </p>
                  {change.result && (
                    <p className="mt-2 flex items-center gap-1 text-sm text-accent-green">
                      <TrendingDown className="h-3 w-3" />
                      {change.result.delta.toFixed(3)}s improvement
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="mb-3 h-12 w-12 text-foreground-muted" />
              <p className="text-foreground">No changes logged yet</p>
              <p className="mt-1 text-sm text-foreground-secondary">
                Use the suggestion tab or add manually
              </p>
            </div>
          )}

          {/* FAB */}
          <button className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-orange text-white shadow-lg hover:bg-accent-orange-hover">
            <Plus className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  )
}

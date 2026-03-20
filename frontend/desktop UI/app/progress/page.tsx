'use client'

import { useState } from 'react'
import {
  ChevronDown,
  TrendingDown,
  TrendingUp,
  Flag,
  MapPin,
  Sparkles,
  Target,
  Activity,
} from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const sessionPoints = [
  { label: 'P1 Mar 6', time: 110.892, type: 'practice' },
  { label: 'P2 Mar 6', time: 109.372, type: 'practice' },
  { label: 'P3 Mar 6', time: 108.568, type: 'practice' },
  { label: 'QP5 Mar 7', time: 106.366, type: 'qualifying' },
  { label: 'QP6 Mar 7', time: 105.972, type: 'qualifying' },
]

const topChanges = [
  { setting: 'Front preload 0 → 2 turns', delta: 1.2, sessions: 3 },
  { setting: 'Rear preload 8 → 10 turns', delta: 0.9, sessions: 2 },
  { setting: 'Front rebound stiffened −2', delta: 0.4, sessions: 1 },
  { setting: 'Fork height +2mm', delta: 0.3, sessions: 2 },
]

const tracks = [
  { name: 'Buttonwillow', config: 'TC#1', best: '1:45.972', date: 'Mar 7, 2026', sessions: 5, trend: 'down' },
  { name: 'Thunderhill', config: '3 mile', best: '2:05.334', date: 'Feb 22, 2026', sessions: 3, trend: 'down' },
  { name: 'Laguna Seca', config: 'Full', best: '1:32.891', date: 'Jan 15, 2026', sessions: 2, trend: 'flat' },
]

const aiInsights = [
  {
    icon: 'trending',
    title: 'Consistent improvement trend',
    body: 'You have found 4.9s over 5 sessions. The rate of improvement is slowing — focus next on aero and braking reference points.',
  },
  {
    icon: 'suspension',
    title: 'Front rebound is your #1 lever',
    body: '3 of your top 5 changes involve front rebound damping. Consider a dedicated rebound tuning session.',
  },
  {
    icon: 'target',
    title: 'Gap to prior best',
    body: '3.0s remains to your all-time best at this circuit. Telemetry indicates T3 and T7 exit are the main deficit sectors.',
  },
]

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

const CHART_W = 560
const CHART_H = 140
const PAD = { top: 10, right: 30, bottom: 10, left: 10 }

function buildPath(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function LapTimeTrendChart({ points }: { points: { label: string; time: number; type: string }[] }) {
  const minT = Math.min(...points.map((p) => p.time))
  const maxT = Math.max(...points.map((p) => p.time))
  const range = maxT - minT || 1
  const priorBest = 102.9

  const toCoord = (t: number, i: number) => ({
    x: PAD.left + (i / (points.length - 1)) * (CHART_W - PAD.left - PAD.right),
    y: PAD.top + ((t - minT + 1) / (range + 2)) * (CHART_H - PAD.top - PAD.bottom),
  })

  const coords = points.map((p, i) => toCoord(p.time, i))
  const pbY = PAD.top + ((priorBest - minT + 1) / (range + 2)) * (CHART_H - PAD.top - PAD.bottom)

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toFixed(3).padStart(6, '0')
    return `${m}:${s}`
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lapGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8520A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#E8520A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={PAD.left}
            y1={PAD.top + frac * (CHART_H - PAD.top - PAD.bottom)}
            x2={CHART_W - PAD.right}
            y2={PAD.top + frac * (CHART_H - PAD.top - PAD.bottom)}
            stroke="#2A2A2A"
            strokeWidth="0.5"
          />
        ))}

        {/* PB dashed */}
        {pbY > 0 && pbY < CHART_H && (
          <line
            x1={PAD.left}
            y1={pbY}
            x2={CHART_W - PAD.right}
            y2={pbY}
            stroke="#8A8A85"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {/* Area fill */}
        <path
          d={`${buildPath(coords)} L ${coords[coords.length - 1].x} ${CHART_H} L ${coords[0].x} ${CHART_H} Z`}
          fill="url(#lapGrad)"
        />

        {/* Line */}
        <path
          d={buildPath(coords)}
          fill="none"
          stroke="#E8520A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r="4"
            fill="#0A0A0A"
            stroke={points[i].type === 'qualifying' ? '#E8520A' : '#3B82F6'}
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* X labels */}
      <div className="flex justify-between px-2 pt-1">
        {points.map((p) => (
          <span key={p.label} className="text-[10px] text-foreground-muted">
            {p.label}
          </span>
        ))}
      </div>

      {/* PB label */}
      {pbY > 0 && pbY < CHART_H && (
        <div
          className="absolute right-0 text-[10px] text-foreground-muted"
          style={{ top: `${(pbY / CHART_H) * 100}%`, transform: 'translateY(-50%)' }}
        >
          PB {formatTime(priorBest)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const [selectedTrack, setSelectedTrack] = useState('Buttonwillow Raceway')

  const totalImprovement = (sessionPoints[0].time - sessionPoints[sessionPoints.length - 1].time).toFixed(3)

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="border-b border-border-subtle bg-background safe-area-top lg:hidden">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          <button className="mt-2 flex items-center gap-2 text-foreground-secondary hover:text-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">{selectedTrack}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Mobile content */}
      <main className="mx-auto max-w-[480px] px-4 py-6 pb-24 lg:hidden">
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Lap Time Trend</h3>
            <div className="h-48">
              <LapTimeTrendChart points={sessionPoints} />
            </div>
          </section>
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">
                {sessionPoints.length}
              </span>
              <span className="text-xs text-foreground-muted">Sessions</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="flex items-center justify-center gap-1">
                <TrendingDown className="h-4 w-4 text-accent-green" />
                <span className="font-mono text-xl font-semibold tabular-nums text-accent-green">
                  {totalImprovement}s
                </span>
              </span>
              <span className="text-xs text-foreground-muted">Found</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">6/9</span>
              <span className="text-xs text-foreground-muted">Applied</span>
            </div>
          </section>
        </div>
      </main>

      <BottomNav />

      {/* ── Desktop layout ── */}
      <div className="hidden lg:flex lg:h-screen lg:flex-col">
        {/* Desktop header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-background-surface px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">Progress</h1>
            <button className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-background-elevated px-3 py-1.5 text-sm text-foreground-secondary hover:border-border hover:text-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {selectedTrack}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-foreground-secondary">
              <TrendingDown className="h-4 w-4 text-accent-green" />
              <span>{totalImprovement}s found this weekend</span>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Main content: two-col grid */}
          <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-5">

            {/* Stat cards row */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Sessions', value: sessionPoints.length.toString(), sub: 'this weekend', color: '' },
                { label: 'Time Found', value: `${totalImprovement}s`, sub: 'from P1 to QP6', color: 'text-accent-green' },
                { label: 'Best Lap', value: '1:45.972', sub: 'QP6 · Lap 4', color: '' },
                { label: 'Applied', value: '6/9', sub: 'AI suggestions', color: '' },
                { label: 'Gap to PB', value: '−3.0s', sub: 'prior best 1:42.9', color: 'text-accent-yellow' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border-subtle bg-background-surface p-4"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted mb-1">
                    {stat.label}
                  </p>
                  <p className={cn('font-mono text-2xl font-semibold tabular-nums', stat.color || 'text-foreground')}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-foreground-secondary mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* Lap time trend (large) */}
            <div className="rounded-lg border border-border-subtle bg-background-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Lap Time Trend</h3>
                <div className="flex items-center gap-4 text-xs text-foreground-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full border-2 border-accent-orange bg-transparent" />
                    Qualifying
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full border-2 border-accent-blue bg-transparent" />
                    Practice
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 border-t border-dashed border-foreground-muted" />
                    Prior best
                  </span>
                </div>
              </div>
              <div className="h-44">
                <LapTimeTrendChart points={sessionPoints} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-background-elevated px-3 py-2 text-sm">
                <span className="text-foreground-secondary">Gap to prior best (1:42.9)</span>
                <span className="font-mono font-semibold tabular-nums text-accent-yellow">3.0s to close</span>
              </div>
            </div>

            {/* Bottom row: efficacy + tracks */}
            <div className="grid grid-cols-2 gap-5">
              {/* Efficacy */}
              <div className="rounded-lg border border-border-subtle bg-background-surface p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Setup Change Efficacy</h3>
                <div className="mb-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-secondary">When changes applied</span>
                    <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                      <TrendingDown className="h-3 w-3" />
                      avg 0.8s / session
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-secondary">When changes skipped</span>
                    <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-foreground-muted">
                      <TrendingDown className="h-3 w-3" />
                      avg 0.1s / session
                    </span>
                  </div>
                </div>

                <div className="border-t border-border-subtle pt-4">
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-foreground-muted">
                    Top Changes by Impact
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {topChanges.map((c, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background-elevated text-[10px] font-semibold text-foreground-muted">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm text-foreground">{c.setting}</span>
                            <span className="ml-3 flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                              <TrendingDown className="h-3 w-3" />
                              {c.delta.toFixed(1)}s
                            </span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-background-elevated">
                            <div
                              className="h-full rounded-full bg-accent-orange"
                              style={{ width: `${(c.delta / topChanges[0].delta) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Best laps by track */}
              <div className="rounded-lg border border-border-subtle bg-background-surface p-5">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Best Laps by Track</h3>
                <div className="flex flex-col gap-3">
                  {tracks.map((track) => (
                    <div
                      key={track.name}
                      className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-foreground-muted" />
                          <span className="font-medium text-foreground">{track.name}</span>
                          <span className="text-xs text-foreground-muted">{track.config}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-xs text-foreground-muted">{track.date}</span>
                          <span className="text-xs text-foreground-muted">{track.sessions} sessions</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {track.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-accent-green" />}
                        {track.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-accent-red" />}
                        <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                          {track.best}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
              {aiInsights.map((insight, i) => (
                <div key={i} className="rounded-lg border border-border-subtle bg-background p-4">
                  <div className="mb-2 flex items-center gap-2">
                    {insight.icon === 'trending' && <Activity className="h-4 w-4 text-accent-orange" />}
                    {insight.icon === 'suspension' && <Target className="h-4 w-4 text-accent-orange" />}
                    {insight.icon === 'target' && <Flag className="h-4 w-4 text-accent-orange" />}
                    <span className="text-sm font-medium text-foreground">{insight.title}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground-secondary">{insight.body}</p>
                </div>
              ))}

              {/* Session-by-session breakdown */}
              <div className="rounded-lg border border-border-subtle bg-background p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                  Session Deltas
                </p>
                <div className="flex flex-col gap-2">
                  {sessionPoints.slice(1).map((p, i) => {
                    const delta = sessionPoints[i].time - p.time
                    const improved = delta > 0
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground-secondary">{p.label}</span>
                        <span
                          className={cn(
                            'flex items-center gap-1 font-mono tabular-nums',
                            improved ? 'text-accent-green' : 'text-accent-red'
                          )}
                        >
                          {improved ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {improved ? '-' : '+'}
                          {Math.abs(delta).toFixed(3)}s
                        </span>
                      </div>
                    )
                  })}
                  <div className="mt-1 border-t border-border-subtle pt-2 flex items-center justify-between text-sm font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="flex items-center gap-1 font-mono tabular-nums text-accent-green">
                      <TrendingDown className="h-3 w-3" />
                      −{totalImprovement}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

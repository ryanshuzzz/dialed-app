'use client'

import { useState } from 'react'
import {
  Plus,
  Timer,
  TrendingDown,
  TrendingUp,
  Star,
  Sparkles,
  Check,
  X,
  ChevronRight,
  Flag,
} from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { SessionCard, SessionType } from '@/components/session-card'
import { LapSparkline } from '@/components/lap-sparkline'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type TabType = 'overview' | 'telemetry' | 'suggestion' | 'changes'

const sessions: {
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

const sessionData = {
  type: 'QUALIFYING' as const,
  date: 'Sat Mar 7',
  time: '9:57 AM',
  bestLap: '1:45.972',
  delta: { value: 0.394, improved: true },
  conditions: { airTemp: 18, condition: 'Dry', frontTire: 'SC1', rearTire: 'SC1' },
  frontSettings: { spring: 10.75, compression: 16, rebound: 12, preload: 2, forkHeight: 8.6 },
  rearSettings: { spring: 110, compression: 12, rebound: 15, preload: 10 },
  feedback: {
    symptoms: ['Brake-to-throttle chatter'],
    text: 'Front chatters as I release the brake and pick up throttle into T4. Feels like the fork is rebounding too fast.',
  },
  stats: { maxSpeed: 155.8, forkTravel: 140.4, bankAngle: 59.6 },
  laps: [
    { number: 1, time: '2:32.836', isOutLap: true },
    { number: 2, time: '1:48.568' },
    { number: 3, time: '1:46.366' },
    { number: 4, time: '1:45.972', isBest: true },
    { number: 5, time: '2:19.256', isInLap: true },
  ],
}

const suggestions = [
  {
    rank: 1,
    setting: 'Front rebound',
    from: 14,
    to: 12,
    change: '2 clicks stiffer',
    confidence: 87,
    symptom: 'Brake-to-throttle chatter',
    reason: 'Fork rebounding too fast at brake release — front tire losing contact before fully unloading',
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
    reason: 'Additional preload will improve initial response and reduce dive during hard braking',
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

const changeHistory = [
  {
    time: '9:47 AM',
    setting: 'Front rebound',
    from: 14,
    to: 12,
    unit: 'clicks out',
    note: 'Addressing brake-to-throttle transition chatter',
    result: { delta: 0.394, improved: true },
    isAi: true,
  },
]

// ---------------------------------------------------------------------------
// Sub-components (desktop detail panel)
// ---------------------------------------------------------------------------

function DetailOverview() {
  return (
    <div className="flex flex-col gap-5">
      {/* Conditions + quick stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border-subtle bg-background-elevated p-3 text-center">
          <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
            {sessionData.stats.maxSpeed}
          </span>
          <span className="text-[11px] text-foreground-muted">mph max</span>
        </div>
        <div className="rounded-lg border border-border-subtle bg-background-elevated p-3 text-center">
          <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
            {sessionData.stats.forkTravel}
          </span>
          <span className="text-[11px] text-foreground-muted">mm fork travel</span>
        </div>
        <div className="rounded-lg border border-border-subtle bg-background-elevated p-3 text-center">
          <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
            {sessionData.stats.bankAngle}°
          </span>
          <span className="text-[11px] text-foreground-muted">bank angle</span>
        </div>
        <div className="rounded-lg border border-border-subtle bg-background-elevated p-3 text-center">
          <span className="block font-mono text-sm font-semibold text-foreground">
            {sessionData.conditions.airTemp}°C · {sessionData.conditions.condition}
          </span>
          <span className="mt-0.5 block font-mono text-xs text-foreground-muted">
            {sessionData.conditions.frontTire} / {sessionData.conditions.rearTire}
          </span>
        </div>
      </div>

      {/* Setup + Feedback row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Setup Snapshot */}
        <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Setup Snapshot
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0">
            {/* Front col */}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Front</p>
              {[
                { label: 'Spring', value: sessionData.frontSettings.spring },
                { label: 'Comp', value: sessionData.frontSettings.compression, changed: false },
                { label: 'Rebound', value: sessionData.frontSettings.rebound, changed: true, delta: -2 },
                { label: 'Preload', value: sessionData.frontSettings.preload },
                { label: 'Fork H.', value: sessionData.frontSettings.forkHeight },
              ].map((r) => (
                <div
                  key={r.label}
                  className={cn(
                    'flex items-center justify-between py-1 text-sm',
                    r.changed && 'rounded px-1.5 -mx-1.5 border-l-2 border-l-accent-orange bg-accent-orange/5'
                  )}
                >
                  <span className="text-foreground-secondary">{r.label}</span>
                  <span className="flex items-center gap-1 font-mono tabular-nums text-foreground">
                    {r.value}
                    {r.changed && (
                      <span className="text-[10px] font-semibold text-accent-orange">{r.delta}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {/* Rear col */}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Rear</p>
              {[
                { label: 'Spring', value: sessionData.rearSettings.spring },
                { label: 'Comp', value: sessionData.rearSettings.compression },
                { label: 'Rebound', value: sessionData.rearSettings.rebound },
                { label: 'Preload', value: sessionData.rearSettings.preload },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-foreground-secondary">{r.label}</span>
                  <span className="font-mono tabular-nums text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rider Feedback */}
        <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Rider Feedback
          </h3>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {sessionData.feedback.symptoms.map((s) => (
              <span
                key={s}
                className="rounded-full border border-accent-orange/30 bg-accent-orange/10 px-2.5 py-1 text-xs text-accent-orange"
              >
                {s}
              </span>
            ))}
          </div>
          <blockquote className="border-l-2 border-border pl-3 text-sm italic leading-relaxed text-foreground-secondary">
            {sessionData.feedback.text}
          </blockquote>

          {/* Lap Table */}
          <div className="mt-4 border-t border-border-subtle pt-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Lap Times</p>
            <div className="flex flex-col gap-1">
              {sessionData.laps.map((lap) => (
                <div
                  key={lap.number}
                  className={cn(
                    'flex items-center justify-between rounded px-2 py-1 text-sm',
                    lap.isBest && 'bg-accent-orange/10'
                  )}
                >
                  <span className={cn('text-foreground-secondary', lap.isBest && 'text-accent-orange font-medium')}>
                    Lap {lap.number}
                    {lap.isOutLap && <span className="ml-1.5 text-[10px] text-foreground-muted">out</span>}
                    {lap.isInLap && <span className="ml-1.5 text-[10px] text-foreground-muted">in</span>}
                  </span>
                  <span className={cn('font-mono tabular-nums', lap.isBest ? 'font-semibold text-accent-orange' : 'text-foreground')}>
                    {lap.time}
                    {lap.isBest && <Star className="ml-1 inline h-3 w-3 fill-accent-orange" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Speed Trace */}
      <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Speed Trace — Best Lap vs Lap 3
        </h3>
        <div className="relative h-40">
          <svg className="h-full w-full" viewBox="0 0 600 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8520A" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#E8520A" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 30, 60, 90, 120].map((y) => (
              <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
            ))}
            <path
              d="M0,100 Q100,40 200,60 T400,30 T560,50 L600,55"
              fill="none" stroke="#F2F2F0" strokeWidth="1.5" opacity="0.35"
            />
            <path
              d="M0,100 Q100,35 200,55 T400,25 T560,45 L600,50"
              fill="url(#speedGrad)" stroke="#E8520A" strokeWidth="2"
            />
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[10px] text-foreground-muted">
            {['0s', '20s', '40s', '60s', '80s', '100s'].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 bg-accent-orange rounded" />
            Best (Lap 4)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 bg-foreground/40 rounded" />
            Lap 3
          </span>
        </div>
      </div>
    </div>
  )
}

function DetailSuggestion() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-orange" />
          <span className="text-sm font-medium text-foreground">AI Analysis</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground-secondary">
          The 2-click rebound change to 12 clicks out is the right call. Telemetry shows the fork extending at ~14 mm/s at brake release — when you pick up throttle before the fork settles, the tire loses consistent contact and chatters. Stiffer rebound slows extension, giving the tire time to load progressively.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {suggestions.map((s) => (
          <div
            key={s.rank}
            className={cn(
              'rounded-lg border p-4',
              s.status === 'applied'
                ? 'border-accent-green/30 bg-accent-green/5'
                : 'border-border-subtle bg-background-surface'
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background-elevated text-[10px] font-semibold text-foreground-muted">
                  {s.rank}
                </span>
                <span className="font-medium text-foreground">{s.setting}</span>
                <span
                  className={cn(
                    'rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    s.status === 'applied'
                      ? 'border-accent-green/30 text-accent-green'
                      : 'border-border text-foreground-muted'
                  )}
                >
                  {s.status === 'applied' ? 'Applied' : 'Pending'}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums">
                <span className="text-foreground-secondary">{s.from}</span>
                <ChevronRight className="h-3 w-3 text-foreground-muted" />
                <span className="font-semibold text-foreground">{s.to}</span>
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-elevated">
                <div
                  className={cn('h-full rounded-full', s.confidence >= 80 ? 'bg-accent-green' : s.confidence >= 60 ? 'bg-accent-yellow' : 'bg-accent-red')}
                  style={{ width: `${s.confidence}%` }}
                />
              </div>
              <span className="text-xs text-foreground-muted">{s.confidence}% conf.</span>
            </div>
            <p className="text-sm text-foreground-secondary">{s.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailChanges() {
  return (
    <div className="flex flex-col gap-3">
      {changeHistory.map((c, i) => (
        <div key={i} className="rounded-lg border border-border-subtle bg-background-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {c.isAi && (
                <span className="flex items-center gap-1 rounded border border-accent-orange/30 bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-orange">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              )}
              <span className="font-medium text-foreground">{c.setting}</span>
              <span className="font-mono text-sm tabular-nums text-foreground-secondary">
                {c.from} → {c.to} {c.unit}
              </span>
            </div>
            <span className="text-xs text-foreground-muted">{c.time}</span>
          </div>
          <p className="mb-2 text-sm text-foreground-secondary">{c.note}</p>
          {c.result && (
            <div className="flex items-center gap-1.5 text-sm">
              {c.result.improved ? (
                <TrendingDown className="h-4 w-4 text-accent-green" />
              ) : (
                <TrendingUp className="h-4 w-4 text-accent-red" />
              )}
              <span className={cn('font-mono font-semibold tabular-nums', c.result.improved ? 'text-accent-green' : 'text-accent-red')}>
                {c.result.improved ? '-' : '+'}{c.result.delta.toFixed(3)}s
              </span>
              <span className="text-foreground-muted">result this session</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionListPage() {
  const [selectedId, setSelectedId] = useState<string>('qp6')
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const tabs: { value: TabType; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'suggestion', label: 'AI Suggestions' },
    { value: 'changes', label: 'Changes' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* ── Mobile / tablet header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-lg font-semibold text-foreground">2021 Honda CBR1000RR-R SP</h1>
              <p className="text-sm text-foreground-secondary">Buttonwillow Raceway · CRA 2026 Round 1</p>
            </div>
            <Link href="/session/new">
              <Button className="h-9 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover">
                <Plus className="h-4 w-4" />
                New Session
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile list ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[480px] px-4 py-6 pb-32 lg:hidden">
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} {...session} />
          ))}
        </div>
      </main>

      {/* Mobile summary bar */}
      <div className="fixed bottom-[68px] left-0 right-0 z-40 border-t border-border-subtle bg-background-surface lg:hidden">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-foreground-muted" />
            <span className="text-sm text-foreground-secondary">Best lap:</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">1:45.972</span>
          </div>
          <LapSparkline times={lapTimesInSeconds} />
        </div>
      </div>

      <BottomNav />

      {/* ── Desktop layout ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:h-screen lg:flex-col">
        {/* Desktop top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-background-surface px-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-sm font-semibold text-foreground">Buttonwillow Raceway — CRA 2026 Round 1</h1>
              <p className="text-xs text-foreground-secondary">2021 Honda CBR1000RR-R SP · Fri–Sat Mar 6–7</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background-elevated px-3 py-1.5">
              <Timer className="h-4 w-4 text-foreground-muted" />
              <span className="text-xs text-foreground-secondary">Weekend best:</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">1:45.972</span>
              <TrendingDown className="h-3 w-3 text-accent-green" />
              <LapSparkline times={lapTimesInSeconds} />
            </div>
            <Link href="/session/new">
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
                  onClick={() => setSelectedId(session.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                    selectedId === session.id
                      ? 'border-accent-orange/30 bg-accent-orange/5'
                      : 'border-transparent hover:border-border-subtle hover:bg-background-elevated'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        session.type === 'QUALIFYING'
                          ? 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow'
                          : session.type === 'RACE'
                          ? 'border-accent-red/30 bg-accent-red/10 text-accent-red'
                          : 'border-accent-blue/30 bg-accent-blue/10 text-accent-blue'
                      )}
                    >
                      {session.type}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {session.bestLap}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">{session.date} · {session.time}</span>
                    {session.delta && (
                      <span
                        className={cn(
                          'flex items-center gap-0.5 font-mono text-xs tabular-nums',
                          session.delta.improved ? 'text-accent-green' : 'text-accent-red'
                        )}
                      >
                        {session.delta.improved ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {session.delta.value.toFixed(1)}s
                      </span>
                    )}
                  </div>
                  {(session.hasAiSuggestion || session.hasTelemetry) && (
                    <div className="mt-2 flex gap-1.5">
                      {session.hasAiSuggestion && (
                        <span className="flex items-center gap-0.5 rounded bg-accent-orange/10 px-1.5 py-0.5 text-[10px] text-accent-orange">
                          <Sparkles className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                      {session.hasTelemetry && (
                        <span className="rounded bg-accent-blue/10 px-1.5 py-0.5 text-[10px] text-accent-blue">
                          Telemetry
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* Right: session detail */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {/* Detail header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-background px-6 py-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-accent-yellow/30 bg-accent-yellow/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-yellow">
                      {sessionData.type}
                    </span>
                    <span className="text-sm text-foreground-secondary">
                      {sessionData.date} · {sessionData.time}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                      {sessionData.bestLap}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-sm font-medium tabular-nums text-accent-green">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {sessionData.delta.value.toFixed(3)}s from last session
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/session/new">
                  <Button
                    variant="outline"
                    className="h-8 gap-1.5 border-border text-sm text-foreground hover:bg-background-elevated"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Edit Session
                  </Button>
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 border-b border-border-subtle bg-background px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'relative py-3 px-1 mr-6 text-sm font-medium transition-colors',
                    activeTab === tab.value
                      ? 'text-accent-orange'
                      : 'text-foreground-muted hover:text-foreground-secondary'
                  )}
                >
                  {tab.label}
                  {activeTab === tab.value && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-orange" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === 'overview' && <DetailOverview />}
              {activeTab === 'suggestion' && <DetailSuggestion />}
              {activeTab === 'changes' && <DetailChanges />}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

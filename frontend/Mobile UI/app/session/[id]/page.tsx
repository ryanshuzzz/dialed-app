'use client'

import { useState } from 'react'
import { ArrowLeft, TrendingDown, Plus, Check, X, Pencil, Sparkles, ChevronDown, Star, Clock } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TabType = 'overview' | 'telemetry' | 'suggestion' | 'changes'

// Mock data based on design doc
const sessionData = {
  type: 'QUALIFYING' as const,
  date: 'Sat Mar 7',
  time: '9:57 AM',
  bestLap: '1:45.972',
  delta: { value: 0.394, improved: true },
  conditions: { airTemp: 18, condition: 'Dry', frontTire: 'SC1', rearTire: 'SC1' },
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
    type: 'suspension',
  },
]

export default function SessionDetailPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedLap, setSelectedLap] = useState(4)
  const [skillLevel, setSkillLevel] = useState<'expert' | 'novice'>('expert')

  const tabs: { value: TabType; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'telemetry', label: 'Telemetry' },
    { value: 'suggestion', label: 'Suggestion' },
    { value: 'changes', label: 'Changes' },
  ]

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <div className="flex items-start gap-3">
            <Link 
              href="/" 
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded border border-accent-yellow/30 bg-accent-yellow/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-yellow">
                  {sessionData.type}
                </span>
                <span className="text-sm text-foreground-secondary">
                  {sessionData.date} · {sessionData.time}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                  {sessionData.bestLap}
                </span>
                <span className="flex items-center gap-1 font-mono text-sm font-medium tabular-nums text-accent-green">
                  <TrendingDown className="h-4 w-4" />
                  {sessionData.delta.value.toFixed(3)}s from last session
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-[480px] px-4">
          <div className="flex border-b border-border-subtle">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'relative flex-1 py-3 text-center text-sm font-medium transition-colors',
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
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Setup Snapshot */}
            <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Setup Snapshot</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Front */}
                <div>
                  <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground-muted">Front</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Spring</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.frontSettings.spring}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Comp</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.frontSettings.compression}</span>
                    </div>
                    <div className={cn(
                      'flex justify-between rounded px-1.5 py-0.5 -mx-1.5',
                      'border-l-2 border-l-accent-orange bg-accent-orange/5'
                    )}>
                      <span className="text-foreground-secondary">Rebound</span>
                      <span className="flex items-center gap-1 font-mono tabular-nums text-foreground">
                        {sessionData.frontSettings.rebound}
                        <span className="text-xs text-accent-orange">-2</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Preload</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.frontSettings.preload}</span>
                    </div>
                  </div>
                </div>

                {/* Rear */}
                <div>
                  <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground-muted">Rear</h4>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Spring</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.rearSettings.spring}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Comp</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.rearSettings.compression}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Rebound</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.rearSettings.rebound}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-secondary">Preload</span>
                      <span className="font-mono tabular-nums text-foreground">{sessionData.rearSettings.preload}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Conditions */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border-subtle bg-background-surface px-3 py-1 text-xs text-foreground-secondary">
                {sessionData.conditions.airTemp}°C air
              </span>
              <span className="rounded-full border border-border-subtle bg-background-surface px-3 py-1 text-xs text-foreground-secondary">
                {sessionData.conditions.condition}
              </span>
              <span className="rounded-full border border-border-subtle bg-background-surface px-3 py-1 text-xs text-foreground-secondary">
                {sessionData.conditions.frontTire} front / {sessionData.conditions.rearTire} rear
              </span>
            </div>

            {/* Rider Feedback */}
            <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <h3 className="mb-3 text-sm font-medium text-foreground-secondary">Rider Feedback</h3>
              <div className="mb-3 flex flex-wrap gap-2">
                {sessionData.feedback.symptoms.map((symptom) => (
                  <span
                    key={symptom}
                    className="rounded-full border border-accent-orange/30 bg-accent-orange/10 px-3 py-1 text-xs text-accent-orange"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
              <blockquote className="border-l-2 border-border pl-4 text-sm italic text-foreground-secondary">
                {sessionData.feedback.text}
              </blockquote>
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                  {sessionData.stats.maxSpeed}
                </span>
                <span className="text-xs text-foreground-muted">mph max</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                  {sessionData.stats.forkTravel}
                </span>
                <span className="text-xs text-foreground-muted">mm fork</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
                <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">
                  {sessionData.stats.bankAngle}°
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
              {sessionData.laps.map((lap) => (
                <button
                  key={lap.number}
                  onClick={() => setSelectedLap(lap.number)}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selectedLap === lap.number
                      ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                      : 'border-border-subtle text-foreground-secondary hover:border-border'
                  )}
                >
                  Lap {lap.number}
                  {lap.isBest && <Star className="h-3 w-3 fill-accent-orange" />}
                </button>
              ))}
            </div>

            {/* Speed Trace Chart */}
            <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Speed Trace</h3>
              <div className="relative h-40">
                {/* Mock chart - in production use Recharts */}
                <svg className="h-full w-full" viewBox="0 0 300 120">
                  <defs>
                    <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8520A" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#E8520A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[0, 30, 60, 90, 120].map((y) => (
                    <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
                  ))}
                  {/* Best lap line (white) */}
                  <path
                    d="M0,100 Q50,40 100,60 T200,30 T280,50 L300,60"
                    fill="none"
                    stroke="#F2F2F0"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                  {/* Selected lap line (orange) */}
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
              <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Fork Travel</h3>
              <div className="relative h-40">
                <svg className="h-full w-full" viewBox="0 0 300 120">
                  {/* Grid lines */}
                  {[0, 30, 60, 90, 120].map((y) => (
                    <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
                  ))}
                  {/* Braking zones highlighted */}
                  <rect x="40" y="0" width="30" height="120" fill="#EF4444" opacity="0.1" />
                  <rect x="140" y="0" width="25" height="120" fill="#EF4444" opacity="0.1" />
                  <rect x="220" y="0" width="20" height="120" fill="#EF4444" opacity="0.1" />
                  {/* Transition zones */}
                  <rect x="70" y="0" width="15" height="120" fill="#EAB308" opacity="0.1" />
                  <rect x="165" y="0" width="15" height="120" fill="#EAB308" opacity="0.1" />
                  {/* Fork travel line */}
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
                <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">15.63</span>
                <span className="text-xs text-foreground-muted">bar max brake</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
                <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">84.3</span>
                <span className="text-xs text-foreground-muted">mm avg @ release</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
                <span className="flex items-center gap-1">
                  <span className="font-mono text-lg font-semibold tabular-nums text-accent-yellow">57%</span>
                </span>
                <span className="text-xs text-foreground-muted">GRPPCT cap</span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-background-surface p-3">
                <span className="block font-mono text-lg font-semibold tabular-nums text-foreground">EB1</span>
                <span className="text-xs text-foreground-muted">+ 15/44 gearing</span>
              </div>
            </section>
          </div>
        )}

        {/* Suggestion Tab */}
        {activeTab === 'suggestion' && (
          <div className="flex flex-col gap-6">
            {/* AI Explanation */}
            <section className="rounded-lg border border-accent-orange/30 bg-gradient-to-b from-accent-orange/10 to-transparent p-4">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent-orange" />
                <span className="font-medium text-foreground">AI Analysis</span>
                <span className="ml-auto text-xs text-foreground-muted">
                  Viewing as: 
                  <button
                    onClick={() => setSkillLevel(skillLevel === 'expert' ? 'novice' : 'expert')}
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
                      The 2-click rebound change to 12 clicks out is the right call. Your telemetry shows the fork extending at roughly 14mm/s at brake release — when you pick up throttle before the fork has settled, the tire loses consistent contact and chatters.
                    </p>
                    <p>
                      Stiffer rebound slows that extension, giving the tire time to load progressively. Fork travel data confirms you&apos;re using 84mm average at brake release, well within range but the extension rate is too fast for your current riding style.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Your front suspension is bouncing back too fast when you let go of the brakes. This makes the tire skip and chatter before it has time to grip the track properly.
                    </p>
                    <p>
                      By slowing down how fast the fork extends (2 clicks stiffer), the tire stays in better contact with the track as you transition from braking to accelerating.
                    </p>
                  </>
                )}
              </div>
            </section>

            {/* Recommendation Cards */}
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.rank}
                className={cn(
                  'rounded-lg border bg-background-surface p-4',
                  suggestion.status === 'applied'
                    ? 'border-accent-green/30'
                    : 'border-border-subtle'
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
                    {suggestion.from} → {suggestion.to}
                  </span>
                  <span className="text-sm text-foreground-secondary">
                    ({suggestion.change})
                  </span>
                </div>

                {/* Confidence bar */}
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
                    <Button size="sm" className="gap-1 bg-accent-orange text-white hover:bg-accent-orange-hover">
                      <Check className="h-3 w-3" />
                      Apply
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 border-border text-foreground">
                      <X className="h-3 w-3" />
                      Skip
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1 border-border text-foreground">
                      <Pencil className="h-3 w-3" />
                      Modify
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Changes Tab */}
        {activeTab === 'changes' && (
          <div className="flex flex-col gap-4">
            {changeHistory.length > 0 ? (
              changeHistory.map((change, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'h-3 w-3 rounded-full',
                      change.type === 'suspension' ? 'bg-accent-orange' : 'bg-accent-blue'
                    )} />
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
                      {change.setting} {change.from} → {change.to} {change.unit}
                    </p>
                    <p className="mt-1 text-sm text-foreground-secondary">&ldquo;{change.note}&rdquo;</p>
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
      </main>

      <BottomNav />
    </div>
  )
}

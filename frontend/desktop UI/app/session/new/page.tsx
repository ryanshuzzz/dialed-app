'use client'

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  ListChecks,
  Minus,
  Mic,
  Pencil,
  Plus,
  Sparkles,
  TrendingDown,
  Check,
  Camera,
  FileSpreadsheet,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StepIndicator } from '@/components/step-indicator'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type SessionType = 'practice' | 'qualifying' | 'race' | 'trackday'
type Compound = 'SC0' | 'SC1' | 'SC2' | 'Road'
type Condition = 'Dry' | 'Damp' | 'Wet'
type FeedbackMode = 'manual' | 'voice' | 'photo' | 'csv'

const sessionTypes: { value: SessionType; label: string }[] = [
  { value: 'practice', label: 'Practice' },
  { value: 'qualifying', label: 'Qualifying' },
  { value: 'race', label: 'Race' },
  { value: 'trackday', label: 'Trackday' },
]

const compounds: Compound[] = ['SC0', 'SC1', 'SC2', 'Road']
const conditions: Condition[] = ['Dry', 'Damp', 'Wet']

const symptoms = [
  'Brake-to-throttle chatter',
  'Front end washes',
  'Lazy turn-in',
  'Mid-corner vagueness',
  'Exit grip loss',
  'Front brake chatter',
  'Rear steps out',
  'Wheelie off corners',
  'Bouncing under braking',
]

const previousFront = { spring: 10.75, compression: 16, rebound: 14, preload: 2, forkHeight: 8.6 }
const previousRear = { spring: 110, compression: 12, rebound: 15, preload: 10 }

// ---------------------------------------------------------------------------
// Compact stepper (for desktop)
// ---------------------------------------------------------------------------

function CompactStepper({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max = 99,
  previousValue,
}: {
  label: string
  value: number
  unit: string
  onChange: (v: number) => void
  min?: number
  max?: number
  previousValue?: number
}) {
  const changed = previousValue !== undefined && previousValue !== value
  const delta = previousValue !== undefined ? value - previousValue : 0

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5',
        changed && 'border-l-2 border-l-accent-orange bg-accent-orange/5'
      )}
    >
      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-foreground">{label}</span>
          {changed && <span className="h-1.5 w-1.5 rounded-full bg-accent-orange" />}
        </div>
        {changed && (
          <span className="text-[11px] text-foreground-muted">was {previousValue}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => value > min && onChange(value - 1)}
          disabled={value <= min}
          className="flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-background text-foreground transition-colors hover:border-border disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex w-16 flex-col items-center">
          <span className="font-mono text-base font-semibold tabular-nums text-foreground leading-tight">
            {value}
          </span>
          <span className="text-[10px] text-foreground-muted leading-tight">{unit}</span>
        </div>
        <button
          onClick={() => value < max && onChange(value + 1)}
          disabled={value >= max}
          className="flex h-7 w-7 items-center justify-center rounded border border-border-subtle bg-background text-foreground transition-colors hover:border-border disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {changed && (
          <span
            className={cn(
              'w-6 text-center text-xs font-semibold tabular-nums',
              delta > 0 ? 'text-accent-orange' : 'text-accent-green'
            )}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop workspace component
// ---------------------------------------------------------------------------

function DesktopWorkspace() {
  const router = useRouter()

  // Session setup state
  const [sessionType, setSessionType] = useState<SessionType>('qualifying')
  const [frontCompound, setFrontCompound] = useState<Compound>('SC1')
  const [rearCompound, setRearCompound] = useState<Compound>('SC1')
  const [newTires, setNewTires] = useState(false)
  const [trackTemp, setTrackTemp] = useState('35')
  const [airTemp, setAirTemp] = useState('18')
  const [condition, setCondition] = useState<Condition>('Dry')
  const [notes, setNotes] = useState('')

  // Suspension state
  const [frontSettings, setFrontSettings] = useState({
    spring: 10.75,
    compression: 16,
    rebound: 12,
    preload: 2,
    forkHeight: 8.6,
  })
  const [rearSettings, setRearSettings] = useState({
    spring: 110,
    compression: 12,
    rebound: 15,
    preload: 10,
  })
  const [gearingFront, setGearingFront] = useState(15)
  const [gearingRear, setGearingRear] = useState(44)

  // Feedback state
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('manual')
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['Brake-to-throttle chatter'])
  const [feedbackText, setFeedbackText] = useState(
    'Front chatters as I release the brake and pick up throttle into T4. Feels like the fork is rebounding too fast.'
  )
  const [bestLap, setBestLap] = useState({ minutes: '1', seconds: '45', millis: '972' })
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [hasRecording, setHasRecording] = useState(false)

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const changedCount = [
    frontSettings.rebound !== previousFront.rebound,
    frontSettings.compression !== previousFront.compression,
    frontSettings.preload !== previousFront.preload,
    rearSettings.rebound !== previousRear.rebound,
    rearSettings.compression !== previousRear.compression,
    rearSettings.preload !== previousRear.preload,
  ].filter(Boolean).length

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) interval = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isRecording])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // AI summary (derived from state)
  const aiSummary = selectedSymptoms.length > 0
    ? `Based on reported symptom "${selectedSymptoms[0]}", the primary suspect is front rebound being too fast. With current settings at ${frontSettings.rebound} clicks out, the fork may be extending faster than the tire can load. Recommendation: stiffen front rebound by 2 clicks.`
    : 'Enter rider feedback and suspension settings to generate AI recommendations.'

  return (
    <div className="hidden h-screen flex-col lg:flex">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-background-surface px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">New Session</h1>
            <p className="text-xs text-foreground-secondary">Buttonwillow Raceway · CRA 2026 Round 1</p>
          </div>
        </div>
        {changedCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-orange/30 bg-accent-orange/10 px-3 py-1.5">
            <ListChecks className="h-4 w-4 text-accent-orange" />
            <span className="text-sm text-accent-orange">
              {changedCount} setting{changedCount !== 1 ? 's' : ''} changed from last session
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 gap-1.5 border-border text-sm text-foreground hover:bg-background-elevated"
            onClick={() => {
              setFrontSettings({ ...previousFront })
              setRearSettings({ ...previousRear })
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy from Last
          </Button>
          <Button
            className="h-8 gap-1.5 bg-accent-orange text-sm font-medium text-white hover:bg-accent-orange-hover"
            onClick={() => router.push('/session/qp6')}
          >
            <Check className="h-3.5 w-3.5" />
            Save Session
          </Button>
        </div>
      </header>

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Column 1: Session Setup ── */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-background-surface">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Session Setup</h2>
          </div>
          <div className="flex flex-col gap-5 p-4">
            {/* Session type */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-foreground-secondary">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {sessionTypes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSessionType(t.value)}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                      sessionType === t.value
                        ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                        : 'border-border-subtle bg-background-elevated text-foreground hover:border-border'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tires */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-foreground-secondary">Tires</Label>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-foreground-muted">Front</p>
                  <div className="flex flex-wrap gap-1.5">
                    {compounds.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFrontCompound(c)}
                        className={cn(
                          'flex h-8 items-center justify-center rounded border px-2.5 text-xs font-medium transition-colors',
                          frontCompound === c
                            ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                            : 'border-border-subtle bg-background-elevated text-foreground-secondary hover:border-border'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-foreground-muted">Rear</p>
                  <div className="flex flex-wrap gap-1.5">
                    {compounds.map((c) => (
                      <button
                        key={c}
                        onClick={() => setRearCompound(c)}
                        className={cn(
                          'flex h-8 items-center justify-center rounded border px-2.5 text-xs font-medium transition-colors',
                          rearCompound === c
                            ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                            : 'border-border-subtle bg-background-elevated text-foreground-secondary hover:border-border'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label htmlFor="new-tires-desk" className="text-sm text-foreground">New tires?</Label>
                  <Switch id="new-tires-desk" checked={newTires} onCheckedChange={setNewTires} />
                </div>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-foreground-secondary">Conditions</Label>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={trackTemp}
                      onChange={(e) => setTrackTemp(e.target.value)}
                      className="h-9 bg-background-elevated pr-8 font-mono tabular-nums text-sm"
                      placeholder="Track °C"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">°C</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={airTemp}
                      onChange={(e) => setAirTemp(e.target.value)}
                      className="h-9 bg-background-elevated pr-8 font-mono tabular-nums text-sm"
                      placeholder="Air °C"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">°C</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {conditions.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={cn(
                        'flex h-8 flex-1 items-center justify-center rounded border text-xs font-medium transition-colors',
                        condition === c
                          ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                          : 'border-border-subtle bg-background-elevated text-foreground-secondary hover:border-border'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder='Notes: e.g. "drying line, T3 still wet"'
                  className="min-h-[64px] w-full resize-none rounded-lg border border-border-subtle bg-background-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Suspension ── */}
        <div className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-background">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Suspension Settings</h2>
          </div>
          <div className="flex flex-col gap-5 p-4">
            {/* Front */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Front — Ohlins FKR</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label className="text-sm text-foreground">Spring rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={frontSettings.spring}
                      onChange={(e) =>
                        setFrontSettings((p) => ({ ...p, spring: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-8 w-20 bg-background text-right font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs text-foreground-muted">N/mm</span>
                  </div>
                </div>
                <CompactStepper
                  label="Compression"
                  value={frontSettings.compression}
                  unit="clicks out"
                  onChange={(v) => setFrontSettings((p) => ({ ...p, compression: v }))}
                  previousValue={previousFront.compression}
                  min={0}
                  max={30}
                />
                <CompactStepper
                  label="Rebound"
                  value={frontSettings.rebound}
                  unit="clicks out"
                  onChange={(v) => setFrontSettings((p) => ({ ...p, rebound: v }))}
                  previousValue={previousFront.rebound}
                  min={0}
                  max={30}
                />
                <CompactStepper
                  label="Preload"
                  value={frontSettings.preload}
                  unit="turns in"
                  onChange={(v) => setFrontSettings((p) => ({ ...p, preload: v }))}
                  previousValue={previousFront.preload}
                  min={0}
                  max={20}
                />
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label className="text-sm text-foreground">Fork height</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={frontSettings.forkHeight}
                      onChange={(e) =>
                        setFrontSettings((p) => ({ ...p, forkHeight: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-8 w-20 bg-background text-right font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs text-foreground-muted">mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rear */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
                Rear — Stock Revalved
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label className="text-sm text-foreground">Spring rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={rearSettings.spring}
                      onChange={(e) =>
                        setRearSettings((p) => ({ ...p, spring: parseFloat(e.target.value) || 0 }))
                      }
                      className="h-8 w-20 bg-background text-right font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs text-foreground-muted">N/mm</span>
                  </div>
                </div>
                <CompactStepper
                  label="Compression"
                  value={rearSettings.compression}
                  unit="clicks out"
                  onChange={(v) => setRearSettings((p) => ({ ...p, compression: v }))}
                  previousValue={previousRear.compression}
                  min={0}
                  max={30}
                />
                <CompactStepper
                  label="Rebound"
                  value={rearSettings.rebound}
                  unit="clicks out"
                  onChange={(v) => setRearSettings((p) => ({ ...p, rebound: v }))}
                  previousValue={previousRear.rebound}
                  min={0}
                  max={30}
                />
                <CompactStepper
                  label="Preload"
                  value={rearSettings.preload}
                  unit="turns"
                  onChange={(v) => setRearSettings((p) => ({ ...p, preload: v }))}
                  previousValue={previousRear.preload}
                  min={0}
                  max={20}
                />
              </div>
            </div>

            {/* Geometry */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Geometry</p>
              <div className="flex flex-col gap-2">
                <CompactStepper
                  label="Gearing front"
                  value={gearingFront}
                  unit="teeth"
                  onChange={setGearingFront}
                  min={12}
                  max={20}
                />
                <CompactStepper
                  label="Gearing rear"
                  value={gearingRear}
                  unit="teeth"
                  onChange={setGearingRear}
                  min={38}
                  max={52}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 3: Feedback + AI ── */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-background">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Rider Feedback</h2>
          </div>
          <div className="flex flex-col gap-5 p-4">
            {/* Mode selector */}
            <div className="flex rounded-lg border border-border-subtle bg-background-surface p-1">
              {([
                { value: 'manual' as FeedbackMode, icon: <Pencil className="h-3.5 w-3.5" />, label: 'Manual' },
                { value: 'voice' as FeedbackMode, icon: <Mic className="h-3.5 w-3.5" />, label: 'Voice' },
                { value: 'photo' as FeedbackMode, icon: <Camera className="h-3.5 w-3.5" />, label: 'Photo' },
                { value: 'csv' as FeedbackMode, icon: <FileSpreadsheet className="h-3.5 w-3.5" />, label: 'CSV' },
              ] as const).map((m) => (
                <button
                  key={m.value}
                  onClick={() => setFeedbackMode(m.value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    feedbackMode === m.value
                      ? 'bg-accent-orange text-white'
                      : 'text-foreground-secondary hover:text-foreground'
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {feedbackMode === 'manual' && (
              <>
                {/* Symptoms */}
                <div>
                  <p className="mb-2 text-xs font-medium text-foreground-secondary">What was the bike doing?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {symptoms.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSymptom(s)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          selectedSymptoms.includes(s)
                            ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                            : 'border-border-subtle text-foreground-secondary hover:border-border'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open feedback */}
                <div>
                  <p className="mb-2 text-xs font-medium text-foreground-secondary">Describe what the bike was doing</p>
                  <div className="relative">
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="min-h-[100px] w-full resize-none rounded-lg border border-border-subtle bg-background-surface px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none"
                      placeholder='e.g. "Front chatters as I release the brake..."'
                    />
                    <span className="absolute bottom-2.5 right-3 text-[10px] text-foreground-muted">
                      {feedbackText.length} / 500
                    </span>
                  </div>
                </div>

                {/* Best lap */}
                <div>
                  <p className="mb-2 text-xs font-medium text-foreground-secondary">Best lap this session</p>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-background-surface px-3 py-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bestLap.minutes}
                      onChange={(e) => setBestLap({ ...bestLap, minutes: e.target.value })}
                      className="w-7 bg-transparent text-center font-mono text-lg tabular-nums text-foreground focus:outline-none"
                      maxLength={1}
                    />
                    <span className="font-mono text-lg text-foreground-muted">:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bestLap.seconds}
                      onChange={(e) => setBestLap({ ...bestLap, seconds: e.target.value })}
                      className="w-10 bg-transparent text-center font-mono text-lg tabular-nums text-foreground focus:outline-none"
                      maxLength={2}
                    />
                    <span className="font-mono text-lg text-foreground-muted">.</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={bestLap.millis}
                      onChange={(e) => setBestLap({ ...bestLap, millis: e.target.value })}
                      className="w-14 bg-transparent text-center font-mono text-lg tabular-nums text-foreground focus:outline-none"
                      maxLength={3}
                    />
                  </div>
                </div>
              </>
            )}

            {feedbackMode === 'voice' && (
              <div className="flex flex-col items-center gap-5 py-6">
                {!hasRecording ? (
                  <>
                    <button
                      onClick={() => {
                        if (isRecording) {
                          setIsRecording(false)
                          setHasRecording(true)
                          setTranscript(
                            'Front chatters as I release the brake and pick up throttle into T4. Feels like the fork is rebounding too fast. Best lap was 1:45.972 on lap 4.'
                          )
                        } else {
                          setIsRecording(true)
                          setRecordingTime(0)
                          setHasRecording(false)
                          setTranscript('')
                        }
                      }}
                      className={cn(
                        'flex h-16 w-16 items-center justify-center rounded-full transition-all',
                        isRecording
                          ? 'animate-pulse bg-accent-red ring-4 ring-accent-red/30'
                          : 'bg-accent-orange hover:bg-accent-orange-hover'
                      )}
                    >
                      <Mic className="h-7 w-7 text-white" />
                    </button>
                    {isRecording && (
                      <span className="font-mono text-xl tabular-nums text-foreground">{formatTime(recordingTime)}</span>
                    )}
                    <p className="text-sm text-foreground-secondary">
                      {isRecording ? 'Recording... tap to stop' : 'Tap to record your feedback'}
                    </p>
                  </>
                ) : (
                  <div className="w-full rounded-lg border border-border-subtle bg-background-surface p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground-muted">Transcript</p>
                    <p className="text-sm text-foreground">{transcript}</p>
                    <Button
                      variant="outline"
                      className="mt-3 gap-1.5 border-border text-sm"
                      onClick={() => { setHasRecording(false); setTranscript('') }}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      Re-record
                    </Button>
                  </div>
                )}
              </div>
            )}

            {feedbackMode !== 'manual' && feedbackMode !== 'voice' && (
              <div className="flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background-surface text-foreground-muted">
                <p className="text-sm">{feedbackMode === 'photo' ? 'Point at setup sheet to capture' : 'Drop AiM .csv file here'}</p>
              </div>
            )}

            {/* Live AI panel */}
            <div className="rounded-lg border border-accent-orange/30 bg-accent-orange/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-orange" />
                <span className="text-sm font-medium text-foreground">Live AI Analysis</span>
                <span className="ml-auto rounded bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-orange">
                  LIVE
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground-secondary">{aiSummary}</p>

              {selectedSymptoms.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-accent-orange/20 pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-muted">Suggested changes</p>
                  <div className="flex items-center justify-between rounded-lg border border-accent-orange/20 bg-background px-3 py-2.5">
                    <div>
                      <span className="text-sm font-medium text-foreground">Front rebound</span>
                      <p className="text-xs text-foreground-secondary">Stiffen by 2 clicks</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums text-foreground-secondary">
                        {frontSettings.rebound}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-foreground-muted" />
                      <span className="font-mono text-sm font-semibold tabular-nums text-accent-orange">
                        {Math.max(0, frontSettings.rebound - 2)}
                      </span>
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-background-elevated">
                        <div className="h-full w-[87%] rounded-full bg-accent-green" />
                      </div>
                      <span className="text-xs text-foreground-muted">87%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background px-3 py-2.5">
                    <div>
                      <span className="text-sm font-medium text-foreground">Rear preload</span>
                      <p className="text-xs text-foreground-secondary">Add 2 turns more</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums text-foreground-secondary">
                        {rearSettings.preload}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-foreground-muted" />
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {rearSettings.preload + 2}
                      </span>
                      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-background-elevated">
                        <div className="h-full w-[72%] rounded-full bg-accent-yellow" />
                      </div>
                      <span className="text-xs text-foreground-muted">72%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Time found estimate */}
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-green/10 px-3 py-2">
                <TrendingDown className="h-4 w-4 text-accent-green" />
                <span className="text-sm text-foreground-secondary">Estimated time gain if applied:</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-accent-green">~0.4s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile wizard (preserved)
// ---------------------------------------------------------------------------

export default function NewSessionPage() {
  const router = useRouter()
  const [sessionType, setSessionType] = useState<SessionType>('practice')
  const [frontCompound, setFrontCompound] = useState<Compound>('SC1')
  const [rearCompound, setRearCompound] = useState<Compound>('SC1')
  const [newTires, setNewTires] = useState(false)
  const [trackTemp, setTrackTemp] = useState('35')
  const [airTemp, setAirTemp] = useState('18')
  const [condition, setCondition] = useState<Condition>('Dry')
  const [notes, setNotes] = useState('')
  const [showConditions, setShowConditions] = useState(false)

  return (
    <>
      {/* Desktop */}
      <DesktopWorkspace />

      {/* Mobile */}
      <div className="min-h-screen bg-background pb-24 lg:hidden">
        <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur safe-area-top">
          <div className="mx-auto max-w-[480px] px-4 py-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <StepIndicator currentStep={1} totalSteps={3} label="Session Setup" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[480px] px-4 py-6">
          <div className="flex flex-col gap-8">
            <section>
              <Label className="mb-3 block text-sm font-medium text-foreground-secondary">Session Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {sessionTypes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSessionType(t.value)}
                    className={cn(
                      'flex h-14 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                      sessionType === t.value
                        ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                        : 'border-border-subtle bg-background-surface text-foreground hover:border-border'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <Label className="mb-3 block text-sm font-medium text-foreground-secondary">Tire Spec</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Front</span>
                  <div className="flex flex-wrap gap-1.5">
                    {compounds.map((c) => (
                      <button
                        key={c}
                        onClick={() => setFrontCompound(c)}
                        className={cn(
                          'flex h-9 items-center justify-center rounded border px-3 text-xs font-medium transition-colors',
                          frontCompound === c
                            ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                            : 'border-border-subtle bg-background-surface text-foreground-secondary hover:border-border'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Rear</span>
                  <div className="flex flex-wrap gap-1.5">
                    {compounds.map((c) => (
                      <button
                        key={c}
                        onClick={() => setRearCompound(c)}
                        className={cn(
                          'flex h-9 items-center justify-center rounded border px-3 text-xs font-medium transition-colors',
                          rearCompound === c
                            ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                            : 'border-border-subtle bg-background-surface text-foreground-secondary hover:border-border'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-3">
                <Label htmlFor="new-tires" className="text-sm text-foreground">New tires?</Label>
                <Switch id="new-tires" checked={newTires} onCheckedChange={setNewTires} />
              </div>
            </section>

            <section>
              <button
                onClick={() => setShowConditions(!showConditions)}
                className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-3 text-left transition-colors hover:border-border"
              >
                <span className="text-sm font-medium text-foreground">Conditions</span>
                <ChevronDown className={cn('h-4 w-4 text-foreground-muted transition-transform', showConditions && 'rotate-180')} />
              </button>
              {showConditions && (
                <div className="mt-3 flex flex-col gap-4 rounded-lg border border-border-subtle bg-background-surface p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={trackTemp}
                        onChange={(e) => setTrackTemp(e.target.value)}
                        className="h-10 bg-background-elevated pr-8 font-mono tabular-nums"
                        placeholder="Track °C"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">°C</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={airTemp}
                        onChange={(e) => setAirTemp(e.target.value)}
                        className="h-10 bg-background-elevated pr-8 font-mono tabular-nums"
                        placeholder="Air °C"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">°C</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {conditions.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCondition(c)}
                        className={cn(
                          'flex h-9 flex-1 items-center justify-center rounded border text-sm font-medium transition-colors',
                          condition === c
                            ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                            : 'border-border-subtle bg-background-elevated text-foreground-secondary hover:border-border'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder='Optional. e.g. "drying line, T3 still wet"'
                    className="min-h-[80px] w-full resize-none rounded-lg border border-border-subtle bg-background-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none"
                  />
                </div>
              )}
            </section>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-background-surface safe-area-bottom">
          <div className="mx-auto max-w-[480px] px-4 py-4">
            <Button
              onClick={() => router.push('/session/new/suspension')}
              className="h-12 w-full gap-2 rounded bg-accent-orange text-base font-medium text-white hover:bg-accent-orange-hover"
            >
              Next: Suspension Setup
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    </>
  )
}

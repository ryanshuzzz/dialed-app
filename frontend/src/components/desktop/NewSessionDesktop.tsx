import { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  ListChecks,
  Minus,
  Mic,
  Pencil,
  Plus,
  Check,
  Camera,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  useSessionFormStore,
  previousFrontSettings,
  previousRearSettings,
} from '@/stores/sessionFormStore'
import { useEvents } from '@/hooks/useEvents'
import { useTracks } from '@/hooks/useTracks'
import { useCreateSession, useCreateSnapshot } from '@/hooks/useSessions'

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

// Compact stepper for desktop
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

export function NewSessionDesktop() {
  const navigate = useNavigate()

  // Form store
  const sessionType = useSessionFormStore((s) => s.sessionType)
  const setSessionType = useSessionFormStore((s) => s.setSessionType)
  const eventId = useSessionFormStore((s) => s.eventId)
  const setEventId = useSessionFormStore((s) => s.setEventId)
  const frontCompound = useSessionFormStore((s) => s.frontCompound)
  const setFrontCompound = useSessionFormStore((s) => s.setFrontCompound)
  const rearCompound = useSessionFormStore((s) => s.rearCompound)
  const setRearCompound = useSessionFormStore((s) => s.setRearCompound)
  const newTires = useSessionFormStore((s) => s.newTires)
  const setNewTires = useSessionFormStore((s) => s.setNewTires)
  const trackTemp = useSessionFormStore((s) => s.trackTemp)
  const setTrackTemp = useSessionFormStore((s) => s.setTrackTemp)
  const airTemp = useSessionFormStore((s) => s.airTemp)
  const setAirTemp = useSessionFormStore((s) => s.setAirTemp)
  const condition = useSessionFormStore((s) => s.condition)
  const setCondition = useSessionFormStore((s) => s.setCondition)
  const notes = useSessionFormStore((s) => s.notes)
  const setNotes = useSessionFormStore((s) => s.setNotes)
  const frontSettings = useSessionFormStore((s) => s.frontSettings)
  const rearSettings = useSessionFormStore((s) => s.rearSettings)
  const updateFrontSetting = useSessionFormStore((s) => s.updateFrontSetting)
  const updateRearSetting = useSessionFormStore((s) => s.updateRearSetting)
  const copyFromLastSession = useSessionFormStore((s) => s.copyFromLastSession)
  const selectedSymptoms = useSessionFormStore((s) => s.selectedSymptoms)
  const toggleSymptom = useSessionFormStore((s) => s.toggleSymptom)
  const feedbackText = useSessionFormStore((s) => s.feedbackText)
  const setFeedbackText = useSessionFormStore((s) => s.setFeedbackText)
  const bestLap = useSessionFormStore((s) => s.bestLap)
  const setBestLap = useSessionFormStore((s) => s.setBestLap)
  const feedbackMode = useSessionFormStore((s) => s.feedbackMode)
  const setFeedbackMode = useSessionFormStore((s) => s.setFeedbackMode)
  const resetForm = useSessionFormStore((s) => s.resetForm)

  const { data: events } = useEvents()
  const { data: tracks } = useTracks()
  const createSession = useCreateSession()
  const createSnapshot = useCreateSnapshot()

  const [saveError, setSaveError] = useState<string | null>(null)

  const trackMap = useMemo(() => {
    const map = new Map<string, string>()
    if (tracks) {
      for (const t of tracks) {
        map.set(t.id, t.config ? `${t.name} ${t.config}` : t.name)
      }
    }
    return map
  }, [tracks])

  const changedCount = [
    frontSettings.rebound !== previousFrontSettings.rebound,
    frontSettings.compression !== previousFrontSettings.compression,
    frontSettings.preload !== previousFrontSettings.preload,
    rearSettings.rebound !== previousRearSettings.rebound,
    rearSettings.compression !== previousRearSettings.compression,
    rearSettings.preload !== previousRearSettings.preload,
  ].filter(Boolean).length

  const handleSave = useCallback(async () => {
    setSaveError(null)
    if (!eventId) {
      setSaveError('Please select an event before saving.')
      return
    }

    const mins = parseInt(bestLap.minutes || '0', 10)
    const secs = parseInt(bestLap.seconds || '0', 10)
    const millis = parseInt(bestLap.millis || '0', 10)
    const hasLap = bestLap.minutes !== '' || bestLap.seconds !== '' || bestLap.millis !== ''
    const manual_best_lap_ms = hasLap ? (mins * 60 + secs) * 1000 + millis : null

    const symptomLine = selectedSymptoms.length > 0 ? `Symptoms: ${selectedSymptoms.join(', ')}` : ''
    const feedbackParts = [symptomLine, feedbackText].filter(Boolean)
    const rider_feedback = feedbackParts.length > 0 ? feedbackParts.join('\n') : null

    try {
      const session = await createSession.mutateAsync({
        event_id: eventId,
        session_type: sessionType,
        manual_best_lap_ms,
        tire_front: { compound: frontCompound },
        tire_rear: { compound: rearCompound },
        rider_feedback,
        ride_metrics: null,
      })

      await createSnapshot.mutateAsync({
        sessionId: session.id,
        data: {
          settings: {
            schema_version: 1,
            front: {
              spring_rate: frontSettings.spring,
              compression: frontSettings.compression,
              rebound: frontSettings.rebound,
              preload: frontSettings.preload,
              ride_height: frontSettings.forkHeight,
            },
            rear: {
              spring_rate: rearSettings.spring,
              compression: rearSettings.compression,
              rebound: rearSettings.rebound,
              preload: rearSettings.preload,
            },
          },
        },
      })

      resetForm()
      navigate(`/sessions/${session.id}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save session.')
    }
  }, [eventId, bestLap, selectedSymptoms, feedbackText, sessionType, frontCompound, rearCompound, frontSettings, rearSettings, createSession, createSnapshot, resetForm, navigate])

  const isSaving = createSession.isPending || createSnapshot.isPending

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mt-4 flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-background-surface px-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">New Session</h1>
          </div>
        </div>
        {changedCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-accent-orange/30 bg-accent-orange/10 px-3 py-1.5">
            <ListChecks className="h-4 w-4 text-accent-orange" />
            <span className="text-sm text-accent-orange">
              {changedCount} setting{changedCount !== 1 ? 's' : ''} changed
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {saveError && (
            <span className="text-sm text-accent-red">{saveError}</span>
          )}
          <Button
            variant="outline"
            className="h-8 gap-1.5 border-border text-sm text-foreground hover:bg-background-elevated"
            onClick={copyFromLastSession}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy from Last
          </Button>
          <Button
            className="h-8 gap-1.5 bg-accent-orange text-sm font-medium text-white hover:bg-accent-orange-hover"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Save Session'}
          </Button>
        </div>
      </header>

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Session Setup */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-background-surface">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Session Setup</h2>
          </div>
          <div className="flex flex-col gap-5 p-4">
            {/* Event */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-foreground-secondary">Event</Label>
              <select
                value={eventId ?? ''}
                onChange={(e) => setEventId(e.target.value || null)}
                className="h-9 w-full rounded-lg border border-border-subtle bg-background-elevated px-3 text-sm text-foreground focus:border-accent-orange focus:outline-none"
              >
                <option value="">Select event...</option>
                {events?.map((event) => (
                  <option key={event.id} value={event.id}>
                    {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {event.track_id ? ` — ${trackMap.get(event.track_id) ?? 'Track'}` : ''}
                  </option>
                ))}
              </select>
            </div>

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

        {/* Column 2: Suspension */}
        <div className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-border-subtle bg-background">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Suspension Settings</h2>
          </div>
          <div className="flex flex-col gap-5 p-4">
            {/* Front */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Front</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label className="text-sm text-foreground">Spring rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={frontSettings.spring}
                      onChange={(e) => updateFrontSetting('spring', parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 bg-background text-right font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs text-foreground-muted">N/mm</span>
                  </div>
                </div>
                <CompactStepper
                  label="Compression"
                  value={frontSettings.compression}
                  unit="clicks out"
                  onChange={(v) => updateFrontSetting('compression', v)}
                  previousValue={previousFrontSettings.compression}
                  min={0} max={30}
                />
                <CompactStepper
                  label="Rebound"
                  value={frontSettings.rebound}
                  unit="clicks out"
                  onChange={(v) => updateFrontSetting('rebound', v)}
                  previousValue={previousFrontSettings.rebound}
                  min={0} max={30}
                />
                <CompactStepper
                  label="Preload"
                  value={frontSettings.preload}
                  unit="turns in"
                  onChange={(v) => updateFrontSetting('preload', v)}
                  previousValue={previousFrontSettings.preload}
                  min={0} max={20}
                />
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label className="text-sm text-foreground">Fork height</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={frontSettings.forkHeight}
                      onChange={(e) => updateFrontSetting('forkHeight', parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 bg-background text-right font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs text-foreground-muted">mm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rear */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Rear</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-elevated px-3 py-2.5">
                  <Label className="text-sm text-foreground">Spring rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={rearSettings.spring}
                      onChange={(e) => updateRearSetting('spring', parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 bg-background text-right font-mono text-sm tabular-nums"
                    />
                    <span className="text-xs text-foreground-muted">N/mm</span>
                  </div>
                </div>
                <CompactStepper
                  label="Compression"
                  value={rearSettings.compression}
                  unit="clicks out"
                  onChange={(v) => updateRearSetting('compression', v)}
                  previousValue={previousRearSettings.compression}
                  min={0} max={30}
                />
                <CompactStepper
                  label="Rebound"
                  value={rearSettings.rebound}
                  unit="clicks out"
                  onChange={(v) => updateRearSetting('rebound', v)}
                  previousValue={previousRearSettings.rebound}
                  min={0} max={30}
                />
                <CompactStepper
                  label="Preload"
                  value={rearSettings.preload}
                  unit="turns"
                  onChange={(v) => updateRearSetting('preload', v)}
                  previousValue={previousRearSettings.preload}
                  min={0} max={20}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Feedback */}
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
              ]).map((m) => (
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

            {feedbackMode !== 'manual' && (
              <div className="flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background-surface text-foreground-muted">
                <p className="text-sm">
                  {feedbackMode === 'voice' && 'Voice recording — use the mobile view'}
                  {feedbackMode === 'photo' && 'Photo capture — use the mobile view'}
                  {feedbackMode === 'csv' && 'CSV upload — use the mobile view'}
                </p>
                <p className="mt-1 text-xs">Switch to Manual mode on desktop</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

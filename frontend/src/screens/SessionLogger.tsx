import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { StepIndicator } from '@/components/common/StepIndicator'
import { NewSessionDesktop } from '@/components/desktop/NewSessionDesktop'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useSessionFormStore } from '@/stores/sessionFormStore'
import { useEvents } from '@/hooks/useEvents'
import { useTracks } from '@/hooks/useTracks'

type SessionType = 'practice' | 'qualifying' | 'race' | 'trackday'
type Compound = 'SC0' | 'SC1' | 'SC2' | 'Road'
type Condition = 'Dry' | 'Damp' | 'Wet'

const sessionTypes: { value: SessionType; label: string }[] = [
  { value: 'practice', label: 'Practice' },
  { value: 'qualifying', label: 'Qualifying' },
  { value: 'race', label: 'Race' },
  { value: 'trackday', label: 'Trackday' },
]

const compounds: Compound[] = ['SC0', 'SC1', 'SC2', 'Road']
const conditions: Condition[] = ['Dry', 'Damp', 'Wet']

export default function SessionLogger() {
  const navigate = useNavigate()

  const sessionType = useSessionFormStore((s) => s.sessionType)
  const setSessionType = useSessionFormStore((s) => s.setSessionType)
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
  const showConditions = useSessionFormStore((s) => s.showConditions)
  const setShowConditions = useSessionFormStore((s) => s.setShowConditions)
  const eventId = useSessionFormStore((s) => s.eventId)
  const setEventId = useSessionFormStore((s) => s.setEventId)

  const { data: events } = useEvents()
  const { data: tracks } = useTracks()

  // Build a lookup map: track_id -> track name (with config)
  const trackMap = useMemo(() => {
    const map = new Map<string, string>()
    if (tracks) {
      for (const t of tracks) {
        map.set(t.id, t.config ? `${t.name} ${t.config}` : t.name)
      }
    }
    return map
  }, [tracks])

  return (
    <>
    {/* Desktop: three-column workspace */}
    <div className="hidden lg:block">
      <NewSessionDesktop />
    </div>

    {/* Mobile: step-by-step wizard */}
    <div className="pb-4 lg:hidden" data-testid="session-logger">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <StepIndicator currentStep={1} totalSteps={3} label="Session Setup" />
      </div>

      <div className="flex flex-col gap-8">
        {/* Event Selector */}
        <section>
          <Label htmlFor="event-select" className="mb-3 block text-sm font-medium text-foreground-secondary">
            Event
          </Label>
          <select
            id="event-select"
            value={eventId ?? ''}
            onChange={(e) => setEventId(e.target.value || null)}
            className="h-10 w-full rounded-lg border border-border-subtle bg-background-surface px-3 text-sm text-foreground focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange"
          >
            <option value="">Select an event...</option>
            {events?.map((event) => (
              <option key={event.id} value={event.id}>
                {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{event.track_id ? ` — ${trackMap.get(event.track_id) ?? 'Unknown Track'}` : ''}
              </option>
            ))}
          </select>
        </section>

        {/* Session Type Selector */}
        <section>
          <Label className="mb-3 block text-sm font-medium text-foreground-secondary">
            Session Type
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {sessionTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setSessionType(type.value)}
                className={cn(
                  'flex h-14 items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                  sessionType === type.value
                    ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                    : 'border-border-subtle bg-background-surface text-foreground hover:border-border',
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tire Spec */}
        <section>
          <Label className="mb-3 block text-sm font-medium text-foreground-secondary">
            Tire Spec
          </Label>
          <div className="grid grid-cols-2 gap-4">
            {/* Front Tire */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Front
              </span>
              <div className="flex flex-wrap gap-1.5">
                {compounds.map((compound) => (
                  <button
                    key={compound}
                    onClick={() => setFrontCompound(compound)}
                    className={cn(
                      'flex h-9 items-center justify-center rounded border px-3 text-xs font-medium transition-colors',
                      frontCompound === compound
                        ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                        : 'border-border-subtle bg-background-surface text-foreground-secondary hover:border-border',
                    )}
                  >
                    {compound}
                  </button>
                ))}
              </div>
              <span className="text-xs text-foreground-muted">Last session: SC1</span>
            </div>

            {/* Rear Tire */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Rear
              </span>
              <div className="flex flex-wrap gap-1.5">
                {compounds.map((compound) => (
                  <button
                    key={compound}
                    onClick={() => setRearCompound(compound)}
                    className={cn(
                      'flex h-9 items-center justify-center rounded border px-3 text-xs font-medium transition-colors',
                      rearCompound === compound
                        ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                        : 'border-border-subtle bg-background-surface text-foreground-secondary hover:border-border',
                    )}
                  >
                    {compound}
                  </button>
                ))}
              </div>
              <span className="text-xs text-foreground-muted">Last session: SC1</span>
            </div>
          </div>

          {/* New Tires Toggle */}
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-3">
            <Label htmlFor="new-tires" className="text-sm text-foreground">
              New tires?
            </Label>
            <Switch id="new-tires" checked={newTires} onCheckedChange={setNewTires} />
          </div>
          {newTires && (
            <p className="mt-2 text-sm text-foreground-secondary">
              Laps on tires: <span className="font-mono tabular-nums">0</span>
            </p>
          )}
        </section>

        {/* Conditions (Collapsible) */}
        <section>
          <button
            onClick={() => setShowConditions(!showConditions)}
            className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-3 text-left transition-colors hover:border-border"
          >
            <span className="text-sm font-medium text-foreground">Conditions</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-foreground-muted transition-transform',
                showConditions && 'rotate-180',
              )}
            />
          </button>

          {showConditions && (
            <div className="mt-3 flex flex-col gap-4 rounded-lg border border-border-subtle bg-background-surface p-4">
              {/* Temperatures */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="track-temp" className="text-xs text-foreground-secondary">
                    Track temp
                  </Label>
                  <div className="relative">
                    <Input
                      id="track-temp"
                      type="number"
                      inputMode="decimal"
                      value={trackTemp}
                      onChange={(e) => setTrackTemp(e.target.value)}
                      className="h-10 bg-background-elevated pr-8 font-mono tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
                      &deg;C
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="air-temp" className="text-xs text-foreground-secondary">
                    Air temp
                  </Label>
                  <div className="relative">
                    <Input
                      id="air-temp"
                      type="number"
                      inputMode="decimal"
                      value={airTemp}
                      onChange={(e) => setAirTemp(e.target.value)}
                      className="h-10 bg-background-elevated pr-8 font-mono tabular-nums"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground-muted">
                      &deg;C
                    </span>
                  </div>
                </div>
              </div>

              {/* Condition Selector */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-foreground-secondary">Condition</Label>
                <div className="flex gap-2">
                  {conditions.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondition(c)}
                      className={cn(
                        'flex h-9 flex-1 items-center justify-center rounded border text-sm font-medium transition-colors',
                        condition === c
                          ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                          : 'border-border-subtle bg-background-elevated text-foreground-secondary hover:border-border',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes" className="text-xs text-foreground-secondary">
                  Notes
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder='Optional. e.g. "drying line, T3 still wet"'
                  className="min-h-[80px] w-full resize-none rounded-lg border border-border-subtle bg-background-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-border-subtle bg-background-surface mt-6 -mx-4 safe-area-bottom lg:hidden">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <Button
            onClick={() => navigate('/sessions/new/suspension')}
            className="h-12 w-full gap-2 rounded bg-accent-orange text-base font-medium text-white hover:bg-accent-orange-hover"
          >
            Next: Suspension Setup
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}

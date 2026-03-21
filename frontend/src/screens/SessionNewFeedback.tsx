import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Mic,
  Camera,
  FileSpreadsheet,
  Pencil,
  Check,
  X,
  Upload,
} from 'lucide-react'
import { StepIndicator } from '@/components/common/StepIndicator'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSessionFormStore } from '@/stores/sessionFormStore'
import { useCreateSession, useCreateSnapshot } from '@/hooks/useSessions'

type FeedbackMode = 'manual' | 'voice' | 'photo' | 'csv'

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

const modes: { value: FeedbackMode; icon: React.ReactNode; label: string }[] = [
  { value: 'manual', icon: <Pencil className="h-4 w-4" />, label: 'Manual' },
  { value: 'voice', icon: <Mic className="h-4 w-4" />, label: 'Voice' },
  { value: 'photo', icon: <Camera className="h-4 w-4" />, label: 'Photo' },
  { value: 'csv', icon: <FileSpreadsheet className="h-4 w-4" />, label: 'CSV' },
]

export default function SessionNewFeedback() {
  const navigate = useNavigate()

  const selectedSymptoms = useSessionFormStore((s) => s.selectedSymptoms)
  const toggleSymptom = useSessionFormStore((s) => s.toggleSymptom)
  const feedbackText = useSessionFormStore((s) => s.feedbackText)
  const setFeedbackText = useSessionFormStore((s) => s.setFeedbackText)
  const bestLap = useSessionFormStore((s) => s.bestLap)
  const setBestLap = useSessionFormStore((s) => s.setBestLap)
  const feedbackMode = useSessionFormStore((s) => s.feedbackMode)
  const setFeedbackMode = useSessionFormStore((s) => s.setFeedbackMode)
  const resetForm = useSessionFormStore((s) => s.resetForm)

  // Step 1 fields
  const eventId = useSessionFormStore((s) => s.eventId)
  const sessionType = useSessionFormStore((s) => s.sessionType)
  const frontCompound = useSessionFormStore((s) => s.frontCompound)
  const rearCompound = useSessionFormStore((s) => s.rearCompound)

  // Step 2 fields
  const frontSettings = useSessionFormStore((s) => s.frontSettings)
  const rearSettings = useSessionFormStore((s) => s.rearSettings)

  const createSession = useCreateSession()
  const createSnapshot = useCreateSnapshot()

  const [saveError, setSaveError] = useState<string | null>(null)

  // Voice mode state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [hasRecording, setHasRecording] = useState(false)

  // CSV mode state
  const [csvParsed, setCsvParsed] = useState(false)

  // Photo mode state
  const [photoTaken, setPhotoTaken] = useState(false)

  // Recording timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false)
      setHasRecording(true)
      setTranscript(
        'Front chatters as I release the brake and pick up throttle into T4. Feels like the fork is rebounding too fast. Best lap was 1:45.972 on lap 4.',
      )
    } else {
      setIsRecording(true)
      setRecordingTime(0)
      setHasRecording(false)
      setTranscript('')
    }
  }

  const handleSaveSession = async () => {
    setSaveError(null)

    if (!eventId) {
      setSaveError('Please select an event in Step 1 before saving.')
      return
    }

    // Convert M:SS.mmm fields to total milliseconds
    const mins = parseInt(bestLap.minutes || '0', 10)
    const secs = parseInt(bestLap.seconds || '0', 10)
    const millis = parseInt(bestLap.millis || '0', 10)
    const hasLap = bestLap.minutes !== '' || bestLap.seconds !== '' || bestLap.millis !== ''
    const manual_best_lap_ms = hasLap
      ? (mins * 60 + secs) * 1000 + millis
      : null

    // Build rider_feedback string combining symptoms and free text
    const symptomLine = selectedSymptoms.length > 0
      ? `Symptoms: ${selectedSymptoms.join(', ')}`
      : ''
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

      // Post setup snapshot with suspension data from Step 2
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
      setSaveError(err instanceof Error ? err.message : 'Failed to save session. Please try again.')
    }
  }

  const isSaving = createSession.isPending || createSnapshot.isPending

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/sessions/new/suspension"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <StepIndicator currentStep={3} totalSteps={3} label="Rider Feedback" />
      </div>

      {/* Mode Selector */}
      <div className="mb-6 flex rounded-lg border border-border-subtle bg-background-surface p-1">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setFeedbackMode(m.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              feedbackMode === m.value
                ? 'bg-accent-orange text-white'
                : 'text-foreground-secondary hover:text-foreground',
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Manual Mode */}
      {feedbackMode === 'manual' && (
        <div className="flex flex-col gap-6">
          {/* Symptom Chips */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground-secondary">
              What was the bike doing?
            </h3>
            <div className="flex flex-wrap gap-2">
              {symptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    selectedSymptoms.includes(symptom)
                      ? 'border-accent-orange bg-accent-orange/10 text-accent-orange'
                      : 'border-border-subtle text-foreground-secondary hover:border-border',
                  )}
                >
                  {symptom}
                </button>
              ))}
            </div>
          </section>

          {/* Open Feedback */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground-secondary">
              Describe what the bike was doing
            </h3>
            <div className="relative">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder='e.g. "Front chatters as I release the brake and pick up throttle into T4. Feels like the fork is rebounding too fast."'
                className="min-h-[120px] w-full resize-none rounded-lg border border-border-subtle bg-background-surface px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent-orange focus:outline-none focus:ring-1 focus:ring-accent-orange"
              />
              <span className="absolute bottom-3 right-3 text-xs text-foreground-muted">
                {feedbackText.length} / 500
              </span>
            </div>
          </section>

          {/* Best Lap */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground-secondary">
              Best lap this session
            </h3>
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-background-surface px-4 py-3">
              <input
                type="text"
                inputMode="numeric"
                value={bestLap.minutes}
                onChange={(e) => setBestLap({ ...bestLap, minutes: e.target.value })}
                className="w-8 bg-transparent text-center font-mono text-xl tabular-nums text-foreground focus:outline-none"
                maxLength={1}
              />
              <span className="font-mono text-xl text-foreground-muted">:</span>
              <input
                type="text"
                inputMode="numeric"
                value={bestLap.seconds}
                onChange={(e) => setBestLap({ ...bestLap, seconds: e.target.value })}
                className="w-12 bg-transparent text-center font-mono text-xl tabular-nums text-foreground focus:outline-none"
                maxLength={2}
              />
              <span className="font-mono text-xl text-foreground-muted">.</span>
              <input
                type="text"
                inputMode="numeric"
                value={bestLap.millis}
                onChange={(e) => setBestLap({ ...bestLap, millis: e.target.value })}
                className="w-16 bg-transparent text-center font-mono text-xl tabular-nums text-foreground focus:outline-none"
                maxLength={3}
              />
            </div>
          </section>
        </div>
      )}

      {/* Voice Mode */}
      {feedbackMode === 'voice' && (
        <div className="flex flex-col items-center gap-6 py-8">
          {!hasRecording ? (
            <>
              {/* Record Button */}
              <button
                onClick={handleRecordToggle}
                className={cn(
                  'flex h-20 w-20 items-center justify-center rounded-full transition-all',
                  isRecording
                    ? 'animate-pulse bg-accent-red ring-4 ring-accent-red/30'
                    : 'bg-accent-orange hover:bg-accent-orange-hover',
                )}
              >
                <Mic className="h-8 w-8 text-white" />
              </button>

              {isRecording ? (
                <>
                  {/* Waveform visualization */}
                  <div className="flex h-16 items-center gap-1">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-accent-orange"
                        style={{
                          height: `${20 + Math.random() * 80}%`,
                          animation: 'pulse 0.5s ease-in-out infinite',
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-2xl tabular-nums text-foreground">
                    {formatTime(recordingTime)}
                  </span>
                  <p className="text-sm text-foreground-secondary">
                    Recording... Tap to stop
                  </p>
                </>
              ) : (
                <p className="text-sm text-foreground-secondary">
                  Tap to record your feedback
                </p>
              )}
            </>
          ) : (
            <>
              {/* Transcript */}
              <div className="w-full rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  Transcript
                </h3>
                <p className="text-sm text-foreground">
                  {transcript.split(/(1:45\.972|lap 4)/gi).map((part, i) =>
                    /1:45\.972/i.test(part) ? (
                      <span
                        key={i}
                        className="rounded bg-accent-blue/20 px-1 text-accent-blue underline"
                      >
                        {part}
                      </span>
                    ) : /lap 4/i.test(part) ? (
                      <span
                        key={i}
                        className="rounded bg-accent-orange/20 px-1 text-accent-orange underline"
                      >
                        {part}
                      </span>
                    ) : (
                      <span key={i}>{part}</span>
                    ),
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setHasRecording(false)
                    setTranscript('')
                  }}
                  className="gap-2 border-border text-foreground"
                >
                  <Mic className="h-4 w-4" />
                  Re-record
                </Button>
                <Button className="gap-2 bg-accent-orange text-white hover:bg-accent-orange-hover">
                  <Check className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Photo Mode */}
      {feedbackMode === 'photo' && (
        <div className="flex flex-col gap-6">
          {!photoTaken ? (
            <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background-surface">
              <div className="relative mb-4 h-48 w-48">
                {/* Camera viewfinder corners */}
                <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-accent-orange" />
                <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-accent-orange" />
                <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-accent-orange" />
                <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-accent-orange" />
              </div>
              <p className="mb-4 text-sm text-foreground-secondary">
                Point at your setup sheet
              </p>
              <Button
                onClick={() => setPhotoTaken(true)}
                className="gap-2 bg-accent-orange text-white hover:bg-accent-orange-hover"
              >
                <Camera className="h-4 w-4" />
                Capture
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-4 text-sm font-medium text-foreground">
                  Extracted Settings
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      label: 'Front compression',
                      value: '16 clicks out',
                      confidence: 95,
                      valid: true,
                    },
                    {
                      label: 'Front rebound',
                      value: '12 clicks out',
                      confidence: 92,
                      valid: true,
                    },
                    {
                      label: 'Rear preload',
                      value: '10 turns',
                      confidence: 88,
                      valid: true,
                    },
                    {
                      label: 'Spring rate',
                      value: '?',
                      confidence: 0,
                      valid: false,
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.valid ? (
                          <Check className="h-4 w-4 text-accent-green" />
                        ) : (
                          <X className="h-4 w-4 text-accent-red" />
                        )}
                        <span className="text-sm text-foreground-secondary">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {item.value}
                        </span>
                        {item.valid && (
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-border-subtle">
                            <div
                              className="h-full bg-accent-green"
                              style={{ width: `${item.confidence}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full gap-2 bg-accent-orange text-white hover:bg-accent-orange-hover">
                <Check className="h-4 w-4" />
                Confirm & Save
              </Button>
            </div>
          )}
        </div>
      )}

      {/* CSV Mode */}
      {feedbackMode === 'csv' && (
        <div className="flex flex-col gap-6">
          {!csvParsed ? (
            <div
              className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background-surface transition-colors hover:border-accent-orange"
              onClick={() => setCsvParsed(true)}
            >
              <Upload className="mb-4 h-12 w-12 text-foreground-muted" />
              <p className="mb-2 text-sm font-medium text-foreground">
                Drop your AiM file here
              </p>
              <p className="text-xs text-foreground-muted">
                or tap to select .csv file
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-accent-green/30 bg-accent-green/10 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Check className="h-5 w-5 text-accent-green" />
                  <span className="font-medium text-accent-green">
                    File parsed successfully
                  </span>
                </div>

                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Session</span>
                    <span className="font-mono text-foreground">Buttonw TC#1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Date</span>
                    <span className="text-foreground">Sat Mar 7, 2026 &middot; 9:57 AM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Duration</span>
                    <span className="font-mono text-foreground">10m 12s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Laps</span>
                    <span className="font-mono text-foreground">5</span>
                  </div>
                  <div className="my-2 border-t border-border-subtle" />
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Best lap</span>
                    <span className="font-mono font-semibold text-accent-green">
                      1:45.972 (Lap 4)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Channels</span>
                    <span className="text-foreground">92 channels &middot; 20Hz</span>
                  </div>
                </div>
              </div>

              {/* Lap breakdown */}
              <div className="rounded-lg border border-border-subtle bg-background-surface p-4">
                <h3 className="mb-3 text-sm font-medium text-foreground">Segments</h3>
                <div className="flex flex-col gap-2 font-mono text-sm tabular-nums">
                  <div className="flex justify-between text-foreground-muted">
                    <span>Lap 1</span>
                    <span>2:32.836 out lap</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Lap 2</span>
                    <span>1:48.568</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Lap 3</span>
                    <span>1:46.366</span>
                  </div>
                  <div className="flex justify-between text-accent-green">
                    <span>Lap 4</span>
                    <span className="flex items-center gap-2">
                      1:45.972
                      <span className="text-xs">best</span>
                    </span>
                  </div>
                  <div className="flex justify-between text-foreground-muted">
                    <span>Lap 5</span>
                    <span>2:19.256 in lap</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-border text-foreground"
                >
                  View raw channels
                </Button>
                <Button className="flex-1 gap-2 bg-accent-orange text-white hover:bg-accent-orange-hover">
                  Confirm & Analyze
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-background-surface safe-area-bottom">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          {saveError && (
            <div className="mb-3 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
              {saveError}
            </div>
          )}
          <Button
            onClick={handleSaveSession}
            disabled={isSaving}
            className="h-12 w-full rounded bg-accent-orange text-base font-medium text-white hover:bg-accent-orange-hover disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Session'}
          </Button>
        </div>
      </div>
    </div>
  )
}

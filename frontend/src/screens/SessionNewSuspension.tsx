import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Copy, ListChecks } from 'lucide-react'
import { StepIndicator } from '@/components/common/StepIndicator'
import { SuspensionSection } from '@/components/common/SuspensionSection'
import { Button } from '@/components/ui/button'
import {
  useSessionFormStore,
  previousFrontSettings,
  previousRearSettings,
} from '@/stores/sessionFormStore'

// Fork icon component
function ForkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v20" />
      <path d="M8 6h8" />
      <path d="M8 10h8" />
      <path d="M10 14h4" />
    </svg>
  )
}

// Shock icon component
function ShockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v4" />
      <rect x="8" y="6" width="8" height="4" rx="1" />
      <path d="M10 10v2" />
      <path d="M14 10v2" />
      <rect x="8" y="12" width="8" height="4" rx="1" />
      <path d="M12 16v6" />
    </svg>
  )
}

function GeometryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

export default function SessionNewSuspension() {
  const navigate = useNavigate()

  const frontSettings = useSessionFormStore((s) => s.frontSettings)
  const rearSettings = useSessionFormStore((s) => s.rearSettings)
  const geometrySettings = useSessionFormStore((s) => s.geometrySettings)
  const updateFrontSetting = useSessionFormStore((s) => s.updateFrontSetting)
  const updateRearSetting = useSessionFormStore((s) => s.updateRearSetting)
  const updateGeometrySetting = useSessionFormStore((s) => s.updateGeometrySetting)
  const copyFromLastSession = useSessionFormStore((s) => s.copyFromLastSession)

  const [frontExpanded, setFrontExpanded] = useState(true)
  const [rearExpanded, setRearExpanded] = useState(true)
  const [geometryExpanded, setGeometryExpanded] = useState(false)

  const changedCount = (() => {
    let count = 0
    if (frontSettings.rebound !== previousFrontSettings.rebound) count++
    if (frontSettings.compression !== previousFrontSettings.compression) count++
    if (frontSettings.preload !== previousFrontSettings.preload) count++
    if (rearSettings.rebound !== previousRearSettings.rebound) count++
    if (rearSettings.compression !== previousRearSettings.compression) count++
    if (rearSettings.preload !== previousRearSettings.preload) count++
    return count
  })()

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/sessions/new"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <StepIndicator currentStep={2} totalSteps={3} label="Suspension Setup" />
      </div>

      {/* Changed banner */}
      {changedCount > 0 && (
        <div className="mb-4">
          <div className="flex w-full items-center gap-3 rounded-lg border border-accent-orange/30 bg-accent-orange/10 px-4 py-3">
            <ListChecks className="h-5 w-5 text-accent-orange" />
            <span className="text-sm text-foreground">
              {changedCount} setting{changedCount !== 1 ? 's' : ''} changed from last session
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Front Suspension */}
        <SuspensionSection
          title="Front"
          subtitle="Ohlins FKR"
          icon={<ForkIcon className="h-5 w-5" />}
          expanded={frontExpanded}
          onToggle={() => setFrontExpanded(!frontExpanded)}
          settings={[
            {
              key: 'spring',
              label: 'Spring rate',
              value: frontSettings.spring,
              unit: 'N/mm',
              type: 'text',
              previousValue: previousFrontSettings.spring,
            },
            {
              key: 'compression',
              label: 'Compression',
              value: frontSettings.compression,
              unit: 'clicks out',
              type: 'stepper',
              previousValue: previousFrontSettings.compression,
              min: 0,
              max: 30,
            },
            {
              key: 'rebound',
              label: 'Rebound',
              value: frontSettings.rebound,
              unit: 'clicks out',
              type: 'stepper',
              previousValue: previousFrontSettings.rebound,
              min: 0,
              max: 30,
            },
            {
              key: 'preload',
              label: 'Preload',
              value: frontSettings.preload,
              unit: 'turns in',
              type: 'stepper',
              previousValue: previousFrontSettings.preload,
              min: 0,
              max: 20,
            },
            {
              key: 'forkHeight',
              label: 'Fork height',
              value: frontSettings.forkHeight,
              unit: 'mm showing',
              type: 'text',
              previousValue: previousFrontSettings.forkHeight,
            },
          ]}
          onSettingChange={(key, value) => updateFrontSetting(key, value)}
        />

        {/* Rear Suspension */}
        <SuspensionSection
          title="Rear"
          subtitle="Stock Revalved"
          icon={<ShockIcon className="h-5 w-5" />}
          expanded={rearExpanded}
          onToggle={() => setRearExpanded(!rearExpanded)}
          settings={[
            {
              key: 'spring',
              label: 'Spring rate',
              value: rearSettings.spring,
              unit: 'N/mm',
              type: 'text',
              previousValue: previousRearSettings.spring,
            },
            {
              key: 'compression',
              label: 'Compression',
              value: rearSettings.compression,
              unit: 'clicks out',
              type: 'stepper',
              previousValue: previousRearSettings.compression,
              min: 0,
              max: 30,
            },
            {
              key: 'rebound',
              label: 'Rebound',
              value: rearSettings.rebound,
              unit: 'clicks out',
              type: 'stepper',
              previousValue: previousRearSettings.rebound,
              min: 0,
              max: 30,
            },
            {
              key: 'preload',
              label: 'Preload',
              value: rearSettings.preload,
              unit: 'turns',
              type: 'stepper',
              previousValue: previousRearSettings.preload,
              min: 0,
              max: 20,
            },
          ]}
          onSettingChange={(key, value) => updateRearSetting(key, value)}
        />

        {/* Geometry Section */}
        <SuspensionSection
          title="Geometry"
          subtitle="Fork height, gearing"
          icon={<GeometryIcon className="h-5 w-5" />}
          expanded={geometryExpanded}
          onToggle={() => setGeometryExpanded(!geometryExpanded)}
          settings={[
            {
              key: 'forkHeight',
              label: 'Fork height',
              value: geometrySettings.forkHeight,
              unit: 'mm above clamp',
              type: 'text',
            },
            {
              key: 'gearingFront',
              label: 'Gearing front',
              value: geometrySettings.gearingFront,
              unit: 'teeth',
              type: 'stepper',
              min: 12,
              max: 20,
            },
            {
              key: 'gearingRear',
              label: 'Gearing rear',
              value: geometrySettings.gearingRear,
              unit: 'teeth',
              type: 'stepper',
              min: 38,
              max: 52,
            },
          ]}
          onSettingChange={(key, value) => updateGeometrySetting(key, value)}
        />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-background-surface safe-area-bottom lg:hidden">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 py-4">
          <Button
            onClick={() => navigate('/sessions/new/feedback')}
            className="h-12 w-full gap-2 rounded bg-accent-orange text-base font-medium text-white hover:bg-accent-orange-hover"
          >
            Next: Rider Feedback
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            onClick={copyFromLastSession}
            className="h-10 w-full gap-2 border-border text-foreground hover:bg-background-elevated"
          >
            <Copy className="h-4 w-4" />
            Quick Copy from Last Session
          </Button>
        </div>
      </div>
    </div>
  )
}

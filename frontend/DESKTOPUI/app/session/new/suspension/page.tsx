'use client'

import { useState } from 'react'
import { ArrowLeft, ChevronRight, Copy, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StepIndicator } from '@/components/step-indicator'
import { SuspensionSection } from '@/components/suspension-section'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

export default function SuspensionSetupPage() {
  const router = useRouter()
  const [frontExpanded, setFrontExpanded] = useState(true)
  const [rearExpanded, setRearExpanded] = useState(true)
  const [geometryExpanded, setGeometryExpanded] = useState(false)

  // Previous session values (from QP5)
  const previousFront = {
    spring: 10.75,
    compression: 16,
    rebound: 14, // Changed this session
    preload: 2,
    forkHeight: 8.6,
  }

  const previousRear = {
    spring: 110,
    compression: 12,
    rebound: 15,
    preload: 10,
  }

  // Current values (for QP6)
  const [frontSettings, setFrontSettings] = useState({
    spring: 10.75,
    compression: 16,
    rebound: 12, // Changed from 14
    preload: 2,
    forkHeight: 8.6,
  })

  const [rearSettings, setRearSettings] = useState({
    spring: 110,
    compression: 12,
    rebound: 15,
    preload: 10,
  })

  const [geometrySettings, setGeometrySettings] = useState({
    forkHeight: 8.6,
    gearingFront: 15,
    gearingRear: 44,
  })

  const changedCount = (() => {
    let count = 0
    if (frontSettings.rebound !== previousFront.rebound) count++
    if (frontSettings.compression !== previousFront.compression) count++
    if (frontSettings.preload !== previousFront.preload) count++
    if (rearSettings.rebound !== previousRear.rebound) count++
    if (rearSettings.compression !== previousRear.compression) count++
    if (rearSettings.preload !== previousRear.preload) count++
    return count
  })()

  const handleQuickCopy = () => {
    setFrontSettings({
      spring: previousFront.spring,
      compression: previousFront.compression,
      rebound: previousFront.rebound,
      preload: previousFront.preload,
      forkHeight: previousFront.forkHeight,
    })
    setRearSettings({
      spring: previousRear.spring,
      compression: previousRear.compression,
      rebound: previousRear.rebound,
      preload: previousRear.preload,
    })
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/session/new" 
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <StepIndicator currentStep={2} totalSteps={3} label="Suspension Setup" />
          </div>
        </div>
      </header>

      {/* Changed banner */}
      {changedCount > 0 && (
        <div className="mx-auto max-w-[480px] px-4 pt-4">
          <button className="flex w-full items-center gap-3 rounded-lg border border-accent-orange/30 bg-accent-orange/10 px-4 py-3 text-left transition-colors hover:bg-accent-orange/15">
            <ListChecks className="h-5 w-5 text-accent-orange" />
            <span className="text-sm text-foreground">
              {changedCount} setting{changedCount !== 1 ? 's' : ''} changed from last session
            </span>
          </button>
        </div>
      )}

      <main className="mx-auto max-w-[480px] px-4 py-6">
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
                previousValue: previousFront.spring,
              },
              {
                key: 'compression',
                label: 'Compression',
                value: frontSettings.compression,
                unit: 'clicks out',
                type: 'stepper',
                previousValue: previousFront.compression,
                min: 0,
                max: 30,
              },
              {
                key: 'rebound',
                label: 'Rebound',
                value: frontSettings.rebound,
                unit: 'clicks out',
                type: 'stepper',
                previousValue: previousFront.rebound,
                min: 0,
                max: 30,
              },
              {
                key: 'preload',
                label: 'Preload',
                value: frontSettings.preload,
                unit: 'turns in',
                type: 'stepper',
                previousValue: previousFront.preload,
                min: 0,
                max: 20,
              },
              {
                key: 'forkHeight',
                label: 'Fork height',
                value: frontSettings.forkHeight,
                unit: 'mm showing',
                type: 'text',
                previousValue: previousFront.forkHeight,
              },
            ]}
            onSettingChange={(key, value) =>
              setFrontSettings((prev) => ({ ...prev, [key]: value }))
            }
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
                previousValue: previousRear.spring,
              },
              {
                key: 'compression',
                label: 'Compression',
                value: rearSettings.compression,
                unit: 'clicks out',
                type: 'stepper',
                previousValue: previousRear.compression,
                min: 0,
                max: 30,
              },
              {
                key: 'rebound',
                label: 'Rebound',
                value: rearSettings.rebound,
                unit: 'clicks out',
                type: 'stepper',
                previousValue: previousRear.rebound,
                min: 0,
                max: 30,
              },
              {
                key: 'preload',
                label: 'Preload',
                value: rearSettings.preload,
                unit: 'turns',
                type: 'stepper',
                previousValue: previousRear.preload,
                min: 0,
                max: 20,
              },
            ]}
            onSettingChange={(key, value) =>
              setRearSettings((prev) => ({ ...prev, [key]: value }))
            }
          />

          {/* Geometry Section */}
          <SuspensionSection
            title="Geometry"
            subtitle="Fork height, gearing"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
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
            }
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
            onSettingChange={(key, value) =>
              setGeometrySettings((prev) => ({ ...prev, [key]: value }))
            }
          />
        </div>
      </main>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-background-surface safe-area-bottom">
        <div className="mx-auto flex max-w-[480px] flex-col gap-2 px-4 py-4">
          <Button
            onClick={() => router.push('/session/new/feedback')}
            className="h-12 w-full gap-2 rounded bg-accent-orange text-base font-medium text-white hover:bg-accent-orange-hover"
          >
            Next: Rider Feedback
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            onClick={handleQuickCopy}
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

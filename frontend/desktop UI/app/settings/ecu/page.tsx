'use client'

import { useState } from 'react'
import { ArrowLeft, AlertTriangle, Zap, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

interface ECUSetting {
  key: string
  label: string
  value: number
  min: number
  max: number
  warning?: string
}

const ecuSettings: ECUSetting[] = [
  { key: 'powerMode', label: 'Power Mode', value: 3, min: 1, max: 5 },
  { key: 'fiMode', label: 'FI Mode', value: 1, min: 1, max: 5 },
  { key: 'igMode', label: 'IG Mode', value: 1, min: 1, max: 5 },
  { key: 'grppctMode', label: 'GRPPCT Mode', value: 2, min: 1, max: 5, warning: 'Currently limiting to 57% throttle body' },
  { key: 'tcsMode', label: 'TCS Mode', value: 5, min: 1, max: 9 },
  { key: 'tractionControl', label: 'Traction Control', value: 3, min: 1, max: 9 },
  { key: 'wheelieMode', label: 'Wheelie Mode', value: 4, min: 1, max: 9 },
  { key: 'engineBraking', label: 'Engine Braking', value: 1, min: 1, max: 5, warning: 'Stacking with 15/44 gearing' },
  { key: 'antiJerkControl', label: 'AntiJerk Control', value: 4, min: 1, max: 9 },
]

export default function ECUSettingsPage() {
  const [settings, setSettings] = useState<Record<string, number>>(
    ecuSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
  )

  const handleChange = (key: string, delta: number) => {
    const setting = ecuSettings.find((s) => s.key === key)
    if (!setting) return

    const newValue = settings[key] + delta
    if (newValue >= setting.min && newValue <= setting.max) {
      setSettings((prev) => ({ ...prev, [key]: newValue }))
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/settings" 
              className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-medium text-foreground">ECU Settings</h1>
              <span className="text-xs text-accent-yellow">Expert Mode</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-yellow" />
            <p className="text-sm text-foreground-secondary">
              <span className="font-medium text-foreground">Expert mode</span> · ECU settings affect engine behavior. Confirm with your technician before changing values on track.
            </p>
          </div>

          {/* Settings Grid */}
          <div className="flex flex-col gap-3">
            {ecuSettings.map((setting) => (
              <div
                key={setting.key}
                className={cn(
                  'rounded-lg border bg-background-surface p-4',
                  setting.warning ? 'border-accent-yellow/30' : 'border-border-subtle'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{setting.label}</span>
                    {setting.warning && (
                      <AlertTriangle className="h-4 w-4 text-accent-yellow" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleChange(setting.key, -1)}
                      disabled={settings[setting.key] <= setting.min}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-background-elevated text-foreground transition-colors hover:border-border active:bg-border-subtle disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[24px] text-center font-mono text-xl font-semibold tabular-nums text-foreground">
                      {settings[setting.key]}
                    </span>
                    <button
                      onClick={() => handleChange(setting.key, 1)}
                      disabled={settings[setting.key] >= setting.max}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-background-elevated text-foreground transition-colors hover:border-border active:bg-border-subtle disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {setting.warning && (
                  <p className="mt-2 text-xs text-accent-yellow">{setting.warning}</p>
                )}
              </div>
            ))}
          </div>

          {/* AI Recommendation Card */}
          <div className="rounded-lg border border-accent-orange/30 bg-gradient-to-b from-accent-orange/10 to-transparent p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent-orange" />
              <span className="font-medium text-foreground">ECU opportunity detected</span>
            </div>
            <div className="space-y-2 text-sm text-foreground-secondary">
              <p>
                <span className="font-medium text-foreground">GRPPCT Mode 2</span> is capping throttle body at 57%.
              </p>
              <p>
                Rider is requesting 82% but only 57% is delivered. Potential: <span className="font-mono tabular-nums text-accent-green">2-3 seconds</span> with map exploration.
              </p>
              <p className="pt-2 text-foreground">
                <span className="font-medium">Recommended next step:</span> test GRPPCT Mode 3 in a practice session before qualifying.
              </p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepperControl } from './stepper-control'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SuspensionSetting {
  key: string
  label: string
  value: number
  unit: string
  type: 'stepper' | 'text'
  previousValue?: number
  min?: number
  max?: number
  step?: number
}

interface SuspensionSectionProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  settings: SuspensionSetting[]
  expanded: boolean
  onToggle: () => void
  onSettingChange: (key: string, value: number) => void
}

export function SuspensionSection({
  title,
  subtitle,
  icon,
  settings,
  expanded,
  onToggle,
  onSettingChange,
}: SuspensionSectionProps) {
  const changedCount = settings.filter(
    (s) => s.previousValue !== undefined && s.previousValue !== s.value
  ).length

  return (
    <div className="rounded-lg border border-border-subtle bg-background-surface">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-background-elevated"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background-elevated text-foreground-secondary">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{title}</span>
            {changedCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-orange px-1.5 text-xs font-medium text-white">
                {changedCount}
              </span>
            )}
          </div>
          <span className="text-sm text-foreground-secondary">{subtitle}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-foreground-muted transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border-subtle p-4">
          {settings.map((setting) =>
            setting.type === 'stepper' ? (
              <StepperControl
                key={setting.key}
                label={setting.label}
                value={setting.value}
                unit={setting.unit}
                previousValue={setting.previousValue}
                onChange={(value) => onSettingChange(setting.key, value)}
                min={setting.min}
                max={setting.max}
                step={setting.step}
              />
            ) : (
              <div
                key={setting.key}
                className={cn(
                  'flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface px-4 py-3',
                  setting.previousValue !== undefined &&
                    setting.previousValue !== setting.value &&
                    'border-l-[3px] border-l-accent-orange'
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <Label className="text-sm text-foreground">{setting.label}</Label>
                  {setting.previousValue !== undefined &&
                    setting.previousValue !== setting.value && (
                      <span className="text-xs text-foreground-muted">
                        was {setting.previousValue} {setting.unit}
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={setting.value}
                    onChange={(e) =>
                      onSettingChange(setting.key, parseFloat(e.target.value) || 0)
                    }
                    className="h-10 w-24 bg-background-elevated text-right font-mono tabular-nums"
                  />
                  <span className="text-sm text-foreground-secondary">{setting.unit}</span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

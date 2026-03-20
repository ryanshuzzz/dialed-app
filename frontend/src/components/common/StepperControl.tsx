import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepperControlProps {
  label: string
  value: number
  unit: string
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  previousValue?: number
  className?: string
}

export function StepperControl({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  previousValue,
  className,
}: StepperControlProps) {
  const hasChanged = previousValue !== undefined && previousValue !== value

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - step)
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }
  }

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + step)
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface px-4 py-3',
        hasChanged && 'border-l-[3px] border-l-accent-orange',
        className
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">{label}</span>
          {hasChanged && (
            <span className="h-1.5 w-1.5 rounded-full bg-accent-orange" />
          )}
        </div>
        {hasChanged && previousValue !== undefined && (
          <span className="text-xs text-foreground-muted">
            was {previousValue} {unit}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleDecrement}
          disabled={value <= min}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-background-elevated text-foreground transition-colors hover:border-border active:bg-border-subtle disabled:opacity-40"
        >
          <Minus className="h-5 w-5" />
        </button>

        <div className="flex min-w-[100px] flex-col items-center">
          <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {value}
          </span>
          <span className="text-xs text-foreground-secondary">{unit}</span>
        </div>

        <button
          onClick={handleIncrement}
          disabled={value >= max}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-background-elevated text-foreground transition-colors hover:border-border active:bg-border-subtle disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

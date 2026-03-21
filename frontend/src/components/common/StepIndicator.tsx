interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  label: string
}

export function StepIndicator({ currentStep, totalSteps, label }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 w-6 rounded-full ${
              i < currentStep
                ? 'bg-accent-orange'
                : 'bg-border-subtle'
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-foreground-secondary">
        {currentStep} of {totalSteps} · {label}
      </span>
    </div>
  )
}

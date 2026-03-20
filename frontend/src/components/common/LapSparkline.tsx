interface LapSparklineProps {
  times: number[] // in seconds
  className?: string
}

export function LapSparkline({ times, className }: LapSparklineProps) {
  if (times.length < 2) return null

  const min = Math.min(...times)
  const max = Math.max(...times)
  const range = max - min || 1

  const width = 100
  const height = 24
  const padding = 2

  const points = times.map((time, i) => {
    const x = padding + (i / (times.length - 1)) * (width - padding * 2)
    const y = height - padding - ((time - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  // Find the index of the best lap
  const bestIndex = times.indexOf(min)
  const bestX = padding + (bestIndex / (times.length - 1)) * (width - padding * 2)
  const bestY = height - padding

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: '100px', height: '24px' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent-orange"
      />
      <circle
        cx={bestX}
        cy={bestY - ((min - min) / range) * (height - padding * 2)}
        r="3"
        className="fill-accent-green"
      />
    </svg>
  )
}

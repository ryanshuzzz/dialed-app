'use client'

import { useState } from 'react'
import { ChevronDown, TrendingDown, TrendingUp, Flag, MapPin } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

// Mock data
const sessions = [
  { date: 'Mar 6 AM', time: 110.892 },
  { date: 'Mar 6 PM', time: 109.372 },
  { date: 'Mar 6 PM', time: 108.568 },
  { date: 'Mar 7 AM', time: 106.366 },
  { date: 'Mar 7 AM', time: 105.972 },
]

const topChanges = [
  { setting: 'Front preload 0 → 2 turns', delta: 1.2 },
  { setting: 'Rear preload 8 → 10 turns', delta: 0.9 },
  { setting: 'Front rebound stiffened', delta: 0.4 },
]

const tracks = [
  { name: 'Buttonwillow', config: 'TC#1', best: '1:45.972', date: 'Mar 7, 2026' },
  { name: 'Thunderhill', config: '3 mile', best: '2:05.334', date: 'Feb 22, 2026' },
  { name: 'Laguna Seca', config: 'Full', best: '1:32.891', date: 'Jan 15, 2026' },
]

export default function ProgressPage() {
  const [selectedTrack, setSelectedTrack] = useState('Buttonwillow Raceway')

  const minTime = Math.min(...sessions.map(s => s.time))
  const maxTime = Math.max(...sessions.map(s => s.time))
  const priorBest = 102.9 // 1:42.9 in seconds

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(3)
    return `${mins}:${secs.padStart(6, '0')}`
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <h1 className="font-mono text-2xl font-semibold text-foreground">Progress</h1>
          <button className="mt-2 flex items-center gap-2 text-foreground-secondary hover:text-foreground">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">{selectedTrack}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Lap Time Trend Chart */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Lap Time Trend</h3>
            <div className="relative h-48">
              <svg className="h-full w-full" viewBox="0 0 320 160" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
                ))}
                
                {/* Prior best line */}
                <line
                  x1="0"
                  y1={160 - ((priorBest - minTime + 5) / (maxTime - minTime + 10)) * 160}
                  x2="320"
                  y2={160 - ((priorBest - minTime + 5) / (maxTime - minTime + 10)) * 160}
                  stroke="#8A8A85"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                
                {/* Data line */}
                <path
                  d={sessions.map((s, i) => {
                    const x = (i / (sessions.length - 1)) * 320
                    const y = 160 - ((s.time - minTime + 5) / (maxTime - minTime + 10)) * 160
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                  }).join(' ')}
                  fill="none"
                  stroke="#E8520A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points */}
                {sessions.map((s, i) => {
                  const x = (i / (sessions.length - 1)) * 320
                  const y = 160 - ((s.time - minTime + 5) / (maxTime - minTime + 10)) * 160
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="5"
                      fill="#0A0A0A"
                      stroke="#E8520A"
                      strokeWidth="2"
                      className="cursor-pointer"
                    />
                  )
                })}
              </svg>

              {/* Y-axis labels */}
              <div className="absolute -left-1 top-0 flex h-full flex-col justify-between text-[10px] text-foreground-muted">
                <span>1:51</span>
                <span>1:46</span>
              </div>

              {/* PB label */}
              <div 
                className="absolute right-2 text-[10px] text-foreground-muted"
                style={{ 
                  top: `${100 - ((priorBest - minTime + 5) / (maxTime - minTime + 10)) * 100}%`,
                  transform: 'translateY(-50%)'
                }}
              >
                PB: 1:42.9
              </div>
            </div>

            {/* Gap to close */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-background-elevated px-3 py-2 text-sm">
              <span className="text-foreground-secondary">Gap to prior best</span>
              <span className="font-mono tabular-nums text-accent-yellow">3.0s to close</span>
            </div>
          </section>

          {/* Stats Row */}
          <section className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">8</span>
              <span className="text-xs text-foreground-muted">Sessions</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="flex items-center justify-center gap-1">
                <TrendingDown className="h-4 w-4 text-accent-green" />
                <span className="font-mono text-2xl font-semibold tabular-nums text-accent-green">4.0s</span>
              </span>
              <span className="text-xs text-foreground-muted">Time found</span>
            </div>
            <div className="rounded-lg border border-border-subtle bg-background-surface p-3 text-center">
              <span className="block font-mono text-2xl font-semibold tabular-nums text-foreground">6/9</span>
              <span className="text-xs text-foreground-muted">Applied</span>
            </div>
          </section>

          {/* Efficacy Section */}
          <section className="rounded-lg border border-border-subtle bg-background-surface p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground-secondary">Did the changes help?</h3>
            
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Changes applied</span>
                <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                  <TrendingDown className="h-3 w-3" />
                  avg 0.8s / session
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Changes skipped</span>
                <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-foreground-muted">
                  <TrendingDown className="h-3 w-3" />
                  avg 0.1s / session
                </span>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Top Changes
              </h4>
              <div className="flex flex-col gap-2">
                {topChanges.map((change, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-accent-orange" />
                      <span className="text-sm text-foreground">{change.setting}</span>
                    </div>
                    <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent-green">
                      <TrendingDown className="h-3 w-3" />
                      {change.delta.toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Best Laps per Track */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-foreground-secondary">Best Laps by Track</h3>
            <div className="flex flex-col gap-3">
              {tracks.map((track) => (
                <div
                  key={track.name}
                  className="flex items-center justify-between rounded-lg border border-border-subtle bg-background-surface p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-foreground-muted" />
                      <span className="font-medium text-foreground">{track.name}</span>
                      <span className="text-xs text-foreground-muted">{track.config}</span>
                    </div>
                    <span className="mt-1 block text-xs text-foreground-muted">{track.date}</span>
                  </div>
                  <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                    {track.best}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

'use client'

import { ArrowLeft, Plus, Timer } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { SessionCard, SessionType } from '@/components/session-card'
import { LapSparkline } from '@/components/lap-sparkline'
import { Button } from '@/components/ui/button'

// Sample data from the design doc
const sessions: {
  id: string
  type: SessionType
  bestLap: string
  delta?: { value: number; improved: boolean }
  date: string
  time: string
  hasAiSuggestion?: boolean
  hasTelemetry?: boolean
}[] = [
  {
    id: 'qp6',
    type: 'QUALIFYING',
    bestLap: '1:45.972',
    delta: { value: 0.4, improved: true },
    date: 'Sat Mar 7',
    time: '9:57 AM',
    hasAiSuggestion: true,
    hasTelemetry: true,
  },
  {
    id: 'qp5',
    type: 'QUALIFYING',
    bestLap: '1:46.366',
    delta: { value: 2.2, improved: true },
    date: 'Sat Mar 7',
    time: '8:15 AM',
    hasTelemetry: true,
  },
  {
    id: 'p3',
    type: 'PRACTICE',
    bestLap: '1:48.568',
    delta: { value: 0.8, improved: true },
    date: 'Fri Mar 6',
    time: '4:30 PM',
    hasTelemetry: true,
  },
  {
    id: 'p2',
    type: 'PRACTICE',
    bestLap: '1:49.372',
    delta: { value: 1.5, improved: true },
    date: 'Fri Mar 6',
    time: '2:00 PM',
  },
  {
    id: 'p1',
    type: 'PRACTICE',
    bestLap: '1:50.892',
    date: 'Fri Mar 6',
    time: '10:00 AM',
  },
]

// Convert lap times to seconds for sparkline
const lapTimesInSeconds = [110.892, 109.372, 108.568, 106.366, 105.972]

export default function SessionListPage() {
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Link 
                href="/garage" 
                className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-background-elevated hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex flex-col gap-0.5">
                <h1 className="text-lg font-semibold text-foreground">
                  2021 Honda CBR1000RR-R SP
                </h1>
                <p className="text-sm text-foreground-secondary">
                  Buttonwillow Raceway · CRA 2026 Round 1
                </p>
              </div>
            </div>
            <Link href="/session/new">
              <Button className="h-9 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover">
                <Plus className="h-4 w-4" />
                New Session
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Session List */}
      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} {...session} />
          ))}
        </div>
      </main>

      {/* Bottom Summary Bar */}
      <div className="fixed bottom-[68px] left-0 right-0 z-40 border-t border-border-subtle bg-background-surface">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-foreground-muted" />
            <span className="text-sm text-foreground-secondary">
              Best lap this weekend:
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              1:45.972
            </span>
          </div>
          <LapSparkline times={lapTimesInSeconds} />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

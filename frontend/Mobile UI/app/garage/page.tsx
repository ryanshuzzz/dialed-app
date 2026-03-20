'use client'

import { Plus, ChevronRight, Wrench } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'

const bikes = [
  {
    id: 'cbr1000rr',
    name: '2021 Honda CBR1000RR-R SP',
    sessions: 8,
    lastSession: 'Mar 7, 2026',
    bestLap: '1:45.972',
    track: 'Buttonwillow TC#1',
  },
  {
    id: 'r6',
    name: '2019 Yamaha YZF-R6',
    sessions: 12,
    lastSession: 'Feb 15, 2026',
    bestLap: '1:52.441',
    track: 'Thunderhill 3mi',
  },
]

export default function GaragePage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-mono text-2xl font-semibold text-foreground">Garage</h1>
              <p className="mt-1 text-sm text-foreground-secondary">
                {bikes.length} bike{bikes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button className="h-9 gap-1.5 rounded bg-accent-orange px-3 text-sm font-medium text-white hover:bg-accent-orange-hover">
              <Plus className="h-4 w-4" />
              Add Bike
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-3">
          {bikes.map((bike) => (
            <Link key={bike.id} href="/">
              <div className="group relative flex items-center gap-4 rounded-lg border border-border-subtle bg-background-surface p-4 transition-colors hover:border-border active:bg-background-elevated">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-background-elevated">
                  <Wrench className="h-6 w-6 text-foreground-muted" />
                </div>
                
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{bike.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-foreground-secondary">
                    <span>{bike.sessions} sessions</span>
                    <span className="text-foreground-muted">·</span>
                    <span>Last: {bike.lastSession}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tabular-nums text-accent-orange">
                      {bike.bestLap}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      @ {bike.track}
                    </span>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-foreground-muted transition-colors group-hover:text-foreground-secondary" />
              </div>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

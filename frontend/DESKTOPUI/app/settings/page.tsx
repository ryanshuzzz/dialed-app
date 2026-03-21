'use client'

import { ChevronRight, User, Gauge, Cpu, Ruler, Download, Info } from 'lucide-react'
import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

interface SettingsItem {
  icon: React.ElementType
  label: string
  description?: string
  href?: string
  value?: string
  badge?: string
}

const settingsGroups: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'Preferences',
    items: [
      {
        icon: User,
        label: 'Skill Level',
        description: 'Affects suggestion verbosity',
        value: 'Expert',
      },
      {
        icon: Gauge,
        label: 'Units',
        description: 'Measurement system',
        value: 'Metric',
      },
      {
        icon: Ruler,
        label: 'Default Bike',
        value: 'CBR1000RR-R SP',
      },
    ],
  },
  {
    title: 'Advanced',
    items: [
      {
        icon: Cpu,
        label: 'ECU Settings',
        description: 'HRC ECU mode configuration',
        href: '/settings/ecu',
        badge: 'Expert',
      },
      {
        icon: Ruler,
        label: 'Sag Calculator',
        description: 'Measure and calculate suspension sag',
        href: '/settings/sag',
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        icon: Download,
        label: 'Export Data',
        description: 'Download all session data as CSV',
      },
    ],
  },
  {
    title: 'About',
    items: [
      {
        icon: Info,
        label: 'App Version',
        value: '1.0.0 (build 42)',
      },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border-subtle bg-background safe-area-top">
        <div className="mx-auto max-w-[480px] px-4 py-6">
          <h1 className="font-mono text-2xl font-semibold text-foreground">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 py-6">
        <div className="flex flex-col gap-6">
          {settingsGroups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                {group.title}
              </h2>
              <div className="overflow-hidden rounded-lg border border-border-subtle bg-background-surface">
                {group.items.map((item, i) => {
                  const Icon = item.icon
                  const content = (
                    <div
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        item.href && 'hover:bg-background-elevated',
                        i !== group.items.length - 1 && 'border-b border-border-subtle'
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background-elevated">
                        <Icon className="h-4 w-4 text-foreground-secondary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                          {item.badge && (
                            <span className="rounded bg-accent-yellow/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-yellow">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-foreground-muted">{item.description}</p>
                        )}
                      </div>
                      {item.value && (
                        <span className="text-sm text-foreground-secondary">{item.value}</span>
                      )}
                      {item.href && (
                        <ChevronRight className="h-4 w-4 text-foreground-muted" />
                      )}
                    </div>
                  )

                  return item.href ? (
                    <Link key={item.label} href={item.href}>
                      {content}
                    </Link>
                  ) : (
                    <div key={item.label}>{content}</div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, Flag, TrendingUp, Sparkles, Settings, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/garage', icon: Car, label: 'Garage' },
  { href: '/', icon: Flag, label: 'Sessions' },
  { href: '/progress', icon: TrendingUp, label: 'Progress' },
  { href: '/ai', icon: Sparkles, label: 'AI' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function DesktopSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[220px] flex-col border-r border-border-subtle bg-background-surface lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border-subtle px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent-orange">
          <Gauge className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-mono text-base font-semibold tracking-tight text-foreground">
          Dialed
        </span>
      </div>

      {/* Bike selector */}
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Active bike</p>
        <p className="mt-0.5 text-sm font-medium text-foreground leading-tight">2021 Honda CBR1000RR-R SP</p>
        <p className="text-xs text-foreground-secondary mt-0.5">Buttonwillow · CRA 2026 R1</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-orange/10 text-accent-orange'
                  : 'text-foreground-secondary hover:bg-background-elevated hover:text-foreground'
              )}
            >
              <Icon
                className={cn('h-4 w-4 shrink-0', isActive ? 'fill-accent-orange/20' : '')}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-subtle px-4 py-3">
        <p className="text-[10px] text-foreground-muted">Dialed v0.1 · Beta</p>
      </div>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Car, Flag, TrendingUp, Sparkles, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/garage', icon: Car, label: 'Garage' },
  { href: '/', icon: Flag, label: 'Sessions' },
  { href: '/progress', icon: TrendingUp, label: 'Progress' },
  { href: '/ai', icon: Sparkles, label: 'AI' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-background-surface safe-area-bottom">
      <div className="mx-auto flex max-w-[480px] items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-1.5 transition-colors',
                isActive
                  ? 'text-accent-orange'
                  : 'text-foreground-muted hover:text-foreground-secondary'
              )}
            >
              <Icon 
                className={cn(
                  'h-5 w-5',
                  isActive ? 'fill-accent-orange/20' : ''
                )} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn(
                'text-[10px] font-medium uppercase tracking-wider',
                isActive ? 'text-accent-orange' : ''
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

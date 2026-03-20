import { Link, useLocation } from 'react-router-dom'
import { Car, Flag, TrendingUp, Sparkles, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore, type NavItem } from '@/stores/uiStore'

interface NavItemDef {
  href: string
  icon: typeof Car
  label: string
  navItem: NavItem
}

// Sessions/Home is always visible regardless of rider_type
const alwaysVisibleItems: NavItemDef[] = [
  { href: '/', icon: Flag, label: 'Sessions', navItem: 'sessions' },
]

const conditionalNavItems: NavItemDef[] = [
  { href: '/garage', icon: Car, label: 'Garage', navItem: 'garage' },
  { href: '/progress', icon: TrendingUp, label: 'Progress', navItem: 'progress' },
  { href: '/ai', icon: Sparkles, label: 'AI', navItem: 'ai' },
  { href: '/settings', icon: Settings, label: 'Settings', navItem: 'settings' },
]

export function BottomNav() {
  const location = useLocation()
  const isNavVisible = useUiStore((s) => s.isNavVisible)

  const visibleItems = [
    ...alwaysVisibleItems,
    ...conditionalNavItems.filter((item) => isNavVisible(item.navItem)),
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-background-surface safe-area-bottom">
      <div className="mx-auto flex max-w-[480px] items-center justify-around px-2 py-2">
        {visibleItems.map((item) => {
          const isActive = item.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              to={item.href}
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

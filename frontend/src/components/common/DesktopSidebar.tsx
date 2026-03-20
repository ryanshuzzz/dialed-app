import { Link, useLocation } from 'react-router-dom'
import { Car, Flag, TrendingUp, Sparkles, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore, type NavItem } from '@/stores/uiStore'
import { useBikes } from '@/hooks/useBikes'

interface NavItemDef {
  href: string
  icon: typeof Car
  label: string
  navItem: NavItem
}

const navItems: NavItemDef[] = [
  { href: '/', icon: Flag, label: 'Sessions', navItem: 'sessions' },
  { href: '/garage', icon: Car, label: 'Garage', navItem: 'garage' },
  { href: '/progress', icon: TrendingUp, label: 'Progress', navItem: 'progress' },
  { href: '/ai', icon: Sparkles, label: 'AI', navItem: 'ai' },
  { href: '/settings', icon: Settings, label: 'Settings', navItem: 'settings' },
]

export function DesktopSidebar() {
  const location = useLocation()
  const isNavVisible = useUiStore((s) => s.isNavVisible)
  const { data: bikes } = useBikes()

  const visibleItems = navItems.filter((item) => isNavVisible(item.navItem))
  const activeBike = bikes?.[0]
  const bikeName = activeBike
    ? `${activeBike.year ? `${activeBike.year} ` : ''}${activeBike.make} ${activeBike.model}`
    : '2021 Honda CBR1000RR-R SP'

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-[220px] flex-col border-r border-border-subtle bg-background-surface lg:flex z-50">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border-subtle px-5">
        <img src="/dialed_logo_v2.svg" alt="Dialed" className="h-7" />
        <span className="font-mono text-base font-semibold tracking-tight text-foreground">
          Dialed
        </span>
      </div>

      {/* Bike selector */}
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">Active bike</p>
        <p className="mt-0.5 text-sm font-medium text-foreground leading-tight">{bikeName}</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              to={item.href}
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
        <p className="text-[10px] text-foreground-muted">Dialed v0.1 &middot; Beta</p>
      </div>
    </aside>
  )
}

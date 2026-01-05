'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  HomeIcon, 
  UsersIcon, 
  SettingsIcon, 
  UserPlusIcon,
  BuildingIcon
} from '@/components/ui/icons'

interface SidebarProps {
  isOwner?: boolean
  workspaceId?: string
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  ownerOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { label: 'Team', href: '/team', icon: UsersIcon },
  { label: 'Invite Members', href: '/team/invite', icon: UserPlusIcon, ownerOnly: true },
  { label: 'Workspace', href: '/workspace', icon: BuildingIcon },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
]

export function Sidebar({ isOwner = false, workspaceId }: SidebarProps) {
  const pathname = usePathname()

  const filteredNavItems = navItems.filter(item => !item.ownerOnly || isOwner)

  return (
    <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-r border-border bg-background md:block">
      <nav className="flex flex-col gap-1 p-4">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

// Mobile bottom navigation
export function MobileNav({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname()

  const mobileItems = navItems.filter(item => !item.ownerOnly || isOwner).slice(0, 5)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

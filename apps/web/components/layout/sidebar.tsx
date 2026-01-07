'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  HomeIcon, 
  UsersIcon, 
  SettingsIcon, 
  UserPlusIcon,
  BuildingIcon,
  OfficeIcon
} from '@/components/ui/icons'
import { type WorkspaceRole, getRolePermissions } from '@/lib/types'

interface SidebarProps {
  role?: WorkspaceRole | string
  workspaceId?: string
  isOpen?: boolean
  onClose?: () => void
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: keyof ReturnType<typeof getRolePermissions>
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: HomeIcon, permission: 'canAccessDashboard' },
  { label: 'Virtual Office', href: '/office', icon: OfficeIcon },
  { label: 'Team', href: '/team', icon: UsersIcon, permission: 'canAccessTeam' },
  { label: 'Invite Members', href: '/team/invite', icon: UserPlusIcon, permission: 'canInviteMembers' },
  { label: 'Workspace', href: '/workspace', icon: BuildingIcon, permission: 'canAccessWorkspace' },
  { label: 'Settings', href: '/settings', icon: SettingsIcon, permission: 'canAccessSettings' },
]

export function Sidebar({ role = 'MEMBER', workspaceId, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const permissions = getRolePermissions(role)

  const filteredNavItems = navItems.filter(item => {
    if (!item.permission) return true
    return permissions[item.permission]
  })

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border bg-background transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <nav className="flex flex-col gap-1 p-4">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose?.()}
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
    </>
  )
}

// Mobile bottom navigation
export function MobileNav({ role = 'MEMBER' }: { role?: string }) {
  const pathname = usePathname()
  const permissions = getRolePermissions(role)

  const mobileItems = navItems
    .filter(item => {
      if (!item.permission) return true
      return permissions[item.permission]
    })
    .slice(0, 5)

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

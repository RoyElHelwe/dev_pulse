'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { 
  DropdownMenu, 
  DropdownTrigger, 
  DropdownContent, 
  DropdownItem, 
  DropdownSeparator, 
  DropdownLabel 
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/hooks/use-auth'
import { 
  SettingsIcon, 
  LogOutIcon, 
  ChevronDownIcon, 
  ShieldIcon,
  BuildingIcon,
  MenuIcon
} from '@/components/ui/icons'

interface HeaderProps {
  workspaceName?: string
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
  /**
   * Optional middle-slot content (e.g. call controls/status).
   * If omitted, the header will just show left + right sections.
   */
  middle?: React.ReactNode
}

export function Header({ workspaceName, sidebarOpen, onToggleSidebar, middle }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="h-16 px-6">
        {/*
          3-column layout:
          - Left: logo/workspace (shrinks if needed)
          - Middle: call option/details (can shrink, but stays centered)
          - Right: user menu (doesn't shrink)

          This prevents the middle section from being covered/clipped by the sides.
        */}
        <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto] items-center gap-4">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-4">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent"
                aria-label="Toggle sidebar"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            )}

            <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">ft</span>
              </div>
              <span className="hidden min-w-0 truncate font-semibold text-foreground md:inline-block">
                ft_transcendence
              </span>
            </Link>

            {workspaceName && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <div className="flex min-w-0 items-center gap-2">
                  <BuildingIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium text-foreground">{workspaceName}</span>
                </div>
              </>
            )}
          </div>

          {/* Middle (call option/details) */}
          <div className="min-w-0 justify-self-center">
            <div className="flex min-w-0 items-center justify-center">
              {middle}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center justify-end gap-4">
            {user && (
              <DropdownMenu>
                <DropdownTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-accent">
                    <Avatar name={user.name || ''} size="sm" showStatus status="online" />
                    <span className="hidden text-sm font-medium md:inline-block">{user.name}</span>
                    <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownTrigger>

                <DropdownContent align="end" className="w-56">
                  <DropdownLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownLabel>

                  <DropdownSeparator />

                  <DropdownItem onClick={() => router.push('/settings')}>
                    <SettingsIcon className="h-4 w-4" />
                    <span>Settings</span>
                  </DropdownItem>

                  <DropdownItem onClick={() => router.push('/settings/security')}>
                    <ShieldIcon className="h-4 w-4" />
                    <span>Security</span>
                  </DropdownItem>

                  <DropdownSeparator />

                  <DropdownItem onClick={handleLogout} destructive>
                    <LogOutIcon className="h-4 w-4" />
                    <span>Log out</span>
                  </DropdownItem>
                </DropdownContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

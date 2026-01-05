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
  BuildingIcon
} from '@/components/ui/icons'

interface HeaderProps {
  workspaceName?: string
}

export function Header({ workspaceName }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo & Workspace */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">ft</span>
            </div>
            <span className="hidden font-semibold text-foreground md:inline-block">
              ft_transcendence
            </span>
          </Link>

          {workspaceName && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <div className="flex items-center gap-2">
                <BuildingIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{workspaceName}</span>
              </div>
            </>
          )}
        </div>

        {/* Right side - User menu */}
        <div className="flex items-center gap-4">
          {user && (
            <DropdownMenu>
              <DropdownTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent transition-colors">
                  <Avatar 
                    name={user.name || ""} 
                    size="sm" 
                    showStatus 
                    status="online"
                  />
                  <span className="hidden text-sm font-medium md:inline-block">
                    {user.name}
                  </span>
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
    </header>
  )
}

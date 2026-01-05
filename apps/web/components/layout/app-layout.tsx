'use client'

import { ReactNode, useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Header } from './header'
import { Sidebar, MobileNav } from './sidebar'
import { useAuth } from '@/lib/hooks/use-auth'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ToastProvider } from '@/components/ui/toast'
import { OnlineStatusProvider } from '@/lib/contexts/online-status-context'
import { type WorkspaceRole, getRolePermissions } from '@/lib/types'

interface AppLayoutProps {
  children: ReactNode
}

interface WorkspaceInfo {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
  isOwner: boolean
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, checkAuth } = useAuth()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const initializedRef = useRef(false)
  const [isRoleChecked, setIsRoleChecked] = useState(false)

  useEffect(() => {
    // Prevent running multiple times using ref (doesn't cause re-render)
    if (initializedRef.current) return
    initializedRef.current = true

    const init = async () => {
      try {
        await checkAuth()
      } catch (error) {
        router.push('/login')
        return
      }

      // Fetch workspace info
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces/status`, {
          credentials: 'include',
        })
        
        if (res.ok) {
          const data = await res.json()
          if (data.hasWorkspace && data.workspace) {
            setWorkspace({
              id: data.workspace.id,
              name: data.workspace.name,
              slug: data.workspace.slug,
              role: data.role as WorkspaceRole,
              isOwner: data.isOwner || data.role === 'OWNER',
            })
          } else {
            // No workspace, redirect to onboarding
            router.push('/onboarding')
          }
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
      } finally {
        setWorkspaceLoading(false)
      }
    }

    init()
  }, [])

  // Check role-based access for current route
  const pathname = usePathname()

  // Role-based route protection
  useEffect(() => {
    if (!workspace || workspaceLoading) return

    const permissions = getRolePermissions(workspace.role)
    
    // Check if user has access to current route
    if (pathname.startsWith('/dashboard') && !permissions.canAccessDashboard) {
      router.push('/team') // Redirect to team page instead
    }
    if (pathname.startsWith('/team/invite') && !permissions.canInviteMembers) {
      router.push('/team')
    }
    setIsRoleChecked(true)
  }, [pathname, workspace, workspaceLoading, router])

  // Show loading while checking auth or workspace
  if (isLoading || workspaceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner message="Loading your workspace..." />
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated || !user || !isRoleChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner message="Redirecting..." />
      </div>
    )
  }

  return (
    <ToastProvider>
      <OnlineStatusProvider userId={user.id} workspaceId={workspace?.id}>
        <div className="min-h-screen bg-background">
          <Header workspaceName={workspace?.name} />
          <Sidebar role={workspace?.role} workspaceId={workspace?.id} />
          
          {/* Main content with sidebar offset */}
          <main className="md:pl-64">
            <div className="container mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>

          {/* Mobile navigation */}
          <MobileNav role={workspace?.role} />
          
          {/* Bottom padding for mobile nav */}
          <div className="h-20 md:hidden" />
        </div>
      </OnlineStatusProvider>
    </ToastProvider>
  )
}

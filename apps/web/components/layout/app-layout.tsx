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
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, checkAuth } = useAuth()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const initializedRef = useRef(false)
  const [isRoleChecked, setIsRoleChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Skip workspace checks on onboarding page
  const isOnboarding = pathname === '/onboarding'
  const isOfficePage = pathname === '/office'

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [pathname, isMobile])

  useEffect(() => {
    // Allow re-initialization when navigating away from onboarding
    if (initializedRef.current && isOnboarding) return
    
    // Reset initialization when leaving onboarding
    if (!isOnboarding && !initializedRef.current) {
      initializedRef.current = true
    }

    const init = async () => {
      try {
        await checkAuth()
      } catch (error) {
        router.push('/login')
        return
      }

      // Skip workspace fetch on onboarding or office page
      if (isOnboarding || isOfficePage) {
        setWorkspaceLoading(false)
        return
      }

      // Fetch workspace info
      setWorkspaceLoading(true)
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
  }, [pathname, isOnboarding])

  // Role-based route protection
  useEffect(() => {
    if (!workspace || workspaceLoading || isOnboarding || isOfficePage) return

    const permissions = getRolePermissions(workspace.role)
    
    // Check if user has access to current route
    if (pathname.startsWith('/dashboard') && !permissions.canAccessDashboard) {
      router.push('/team') // Redirect to team page instead
    }
    if (pathname.startsWith('/team/invite') && !permissions.canInviteMembers) {
      router.push('/team')
    }
    setIsRoleChecked(true)
  }, [pathname, workspace, workspaceLoading, router, isOnboarding, isOfficePage])

  // Show loading while checking auth (but not on onboarding or office page)
  if (isLoading || (workspaceLoading && !isOnboarding && !isOfficePage)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner message="Loading your workspace..." />
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner message="Redirecting..." />
      </div>
    )
  }

  // On onboarding page, show minimal layout
  if (isOnboarding) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </ToastProvider>
    )
  }

  // Regular layout with sidebar (requires workspace and role check)
  if (!isRoleChecked && !isOfficePage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner message="Loading..." />
      </div>
    )
  }

  return (
    <ToastProvider>
      <OnlineStatusProvider userId={user.id} workspaceId={workspace?.id}>
        <div className="min-h-screen bg-background">
          <Header workspaceName={workspace?.name} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <Sidebar 
            role={workspace?.role} 
            workspaceId={workspace?.id} 
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          
          {/* Main content with sidebar offset - fullscreen for office page */}
          <main className={isOfficePage ? "" : `transition-all duration-300 ${sidebarOpen && !isMobile ? 'md:pl-64' : ''}`}>
            {isOfficePage ? (
              children
            ) : (
              <div className="container mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
                {children}
              </div>
            )}
          </main>

          {/* Mobile navigation - hide on office page */}
          {!isOfficePage && <MobileNav role={workspace?.role} />}
          
          {/* Bottom padding for mobile nav */}
          {!isOfficePage && <div className="h-20 md:hidden" />}
        </div>
      </OnlineStatusProvider>
    </ToastProvider>
  )
}

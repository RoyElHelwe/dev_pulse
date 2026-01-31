'use client'

import { ReactNode, useEffect, useState } from 'react'
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
  const { user, isAuthenticated, isLoading, checkAuth, _hasHydrated } = useAuth()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [isRoleChecked, setIsRoleChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [initTrigger, setInitTrigger] = useState(0)
  const [isBackNavigation, setIsBackNavigation] = useState(false)

  // Skip workspace checks on onboarding page
  const isOnboarding = pathname === '/onboarding'
  const isOfficePage = pathname === '/office'

  // If the user already has a workspace, they should not be able to return to onboarding
  // via browser back/forward navigation.
  useEffect(() => {
    if (!isOnboarding) return
    if (!_hasHydrated) return
    if (!isAuthenticated || !user) return

    // If workspace already loaded, immediately bump them back to the app.
    if (workspace?.id) {
      router.replace('/dashboard')
    }
  }, [_hasHydrated, isAuthenticated, user, isOnboarding, workspace?.id, router])

  // Handle browser back/forward navigation and bfcache restoration.
  // Important: Don't force a global re-init when the user navigates within onboarding.
  // Next's `usePathname()` will update on navigation; we only want to refresh workspace state
  // when leaving onboarding/office to the app area.
  useEffect(() => {
    const shouldSkip = () => {
      const currentPath = window.location.pathname
      return currentPath === '/onboarding' || currentPath === '/office'
    }

    const resetAppStateForNav = () => {
      // If we navigated *to* onboarding/office, stop any workspace loading state.
      if (shouldSkip()) {
        setWorkspaceLoading(false)
        setIsRoleChecked(true) // avoid role-gate spinner while on onboarding/office
        setIsBackNavigation(false)
        return
      }

      // Otherwise, re-check workspace/role for protected areas.
      setIsRoleChecked(false)
      setWorkspaceLoading(true)
      setIsBackNavigation(true)
      setInitTrigger((prev) => prev + 1)
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      resetAppStateForNav()
    }

    const handlePopState = () => {
      resetAppStateForNav()
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

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
    // Don't run until zustand has hydrated from localStorage
    if (!_hasHydrated) return

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
        setIsRoleChecked(true)
        setIsBackNavigation(false)
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
            setWorkspaceLoading(false)
          } else {
            // No workspace exists -> always go to onboarding (don't special-case back nav here)
            setWorkspaceLoading(false)
            router.push('/onboarding')
          }
        } else {
          setWorkspaceLoading(false)
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
        setWorkspaceLoading(false)
      } finally {
        setIsBackNavigation(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, initTrigger, isOnboarding, isOfficePage])

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

  // Show loading while hydrating or checking auth (but not on onboarding or office page)
  if (!_hasHydrated || isLoading || (workspaceLoading && !isOnboarding && !isOfficePage)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner message="Loading your workspace..." />
      </div>
    )
  }

  // Not authenticated (only check after hydration)
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
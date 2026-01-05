'use client'

import { ReactNode, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from './header'
import { Sidebar, MobileNav } from './sidebar'
import { useAuth } from '@/lib/hooks/use-auth'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ToastProvider } from '@/components/ui/toast'

interface AppLayoutProps {
  children: ReactNode
}

interface WorkspaceInfo {
  id: string
  name: string
  slug: string
  role: string
  isOwner: boolean
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, checkAuth } = useAuth()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const initializedRef = useRef(false)

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
        const res = await fetch('http://localhost:4000/workspaces/status', {
          credentials: 'include',
        })
        
        if (res.ok) {
          const data = await res.json()
          if (data.hasWorkspace && data.workspace) {
            setWorkspace({
              id: data.workspace.id,
              name: data.workspace.name,
              slug: data.workspace.slug,
              role: data.role,
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

  // Show loading while checking auth or workspace
  if (isLoading || workspaceLoading) {
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

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <Header workspaceName={workspace?.name} />
        <Sidebar isOwner={workspace?.isOwner} workspaceId={workspace?.id} />
        
        {/* Main content with sidebar offset */}
        <main className="md:pl-64">
          <div className="container mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        {/* Mobile navigation */}
        <MobileNav isOwner={workspace?.isOwner} />
        
        {/* Bottom padding for mobile nav */}
        <div className="h-20 md:hidden" />
      </div>
    </ToastProvider>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/use-auth'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Card } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, checkAuth } = useAuth()

  useEffect(() => {
    // Always check auth on mount - this will trigger refresh if needed
    const verifyAuth = async () => {
      try {
        await checkAuth()
      } catch (error) {
        console.error('Failed to verify auth:', error)
        // Only redirect after checkAuth fails (including refresh attempts)
        router.push('/login')
      }
    }
    verifyAuth()
  }, [])

  console.log('Dashboard state:', { user, isAuthenticated, isLoading })

  // Show loading while checking auth or loading user
  if (isLoading || (!isAuthenticated && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    )
  }

  // Only redirect to login if explicitly not authenticated after loading completes
  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="Redirecting..." />
      </div>
    )
  }

  return (
    <DashboardLayout title={`Welcome back, ${user.name}!`}>
      <p className="text-muted-foreground mb-8">This is your protected dashboard.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile Card */}
        <Card title="Profile">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Name:</span> {user.name}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Email:</span> {user.email}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">2FA:</span>{' '}
              {user.twoFactorEnabled ? (
                <span className="text-green-600">✓ Enabled</span>
              ) : (
                <span className="text-yellow-600">✗ Disabled</span>
              )}
            </p>
          </div>
          <Button
            className="mt-4 w-full"
            variant="outline"
            onClick={() => router.push('/settings/security')}
          >
            Security Settings
          </Button>
        </Card>

        {/* Quick Stats */}
        <Card title="Quick Stats">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Projects</span>
              <span className="font-semibold text-primary">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tasks Completed</span>
              <span className="font-semibold text-primary">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Sessions</span>
              <span className="font-semibold text-primary">1</span>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <Card title="Quick Actions">
          <div className="space-y-2">
            <Button className="w-full" disabled>
              New Project
            </Button>
            <Button className="w-full" variant="outline" disabled>
              New Task
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push('/settings/security')}
            >
              Manage Sessions
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}

'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/use-auth'

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-primary">ft_transcendence</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.name} ({user?.email})
            </span>
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {title && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">{title}</h2>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

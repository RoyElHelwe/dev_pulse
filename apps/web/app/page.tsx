'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-primary via-primary to-[hsl(var(--chart-3))]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-foreground border-t-transparent mx-auto mb-4"></div>
          <p className="text-primary-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-primary via-primary to-[hsl(var(--chart-3))]">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-primary-foreground">
          ft_transcendence
        </h1>
        <p className="mb-8 text-xl text-primary-foreground/90">
          Collaborative Workspace with 2D Metaverse
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              Login
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="mt-16 text-center text-primary-foreground/90">
        <p className="text-sm">✅ Authentication System Complete</p>
        <p className="text-xs mt-4 opacity-75">
          Next.js 16 • NestJS • PostgreSQL • Redis • NATS • Phaser.js
        </p>
      </div>
    </div>
  )
}


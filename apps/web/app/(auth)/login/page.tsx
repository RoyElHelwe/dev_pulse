'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authService } from '@/lib/auth-service'
import { useAuth } from '@/lib/hooks/use-auth'
import { loginSchema } from '@/lib/schemas'
import { AlertCircleIcon, BuildingIcon, ShieldIcon } from '@/components/ui/icons'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams?.get('invitationToken')
  const invitedEmail = searchParams?.get('email')
  const redirectTo = searchParams?.get('from') || '/dashboard'
  
  const { setUser } = useAuth()
  const [formData, setFormData] = useState({ 
    email: invitedEmail || '', 
    password: '' 
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [userId, setUserId] = useState('')
  const [token2FA, setToken2FA] = useState('')
  const [invitationInfo, setInvitationInfo] = useState<{ workspaceName: string; email: string } | null>(null)

  // If there's an invitation token, fetch the workspace info
  useEffect(() => {
    if (invitationToken) {
      fetch(`http://localhost:4000/invitations/validate/${invitationToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.invitation?.workspace) {
            setInvitationInfo({ 
              workspaceName: data.invitation.workspace.name,
              email: data.invitation.email
            })
            if (data.invitation.email && !formData.email) {
              setFormData(prev => ({ ...prev, email: data.invitation.email }))
            }
          }
        })
        .catch(() => {})
    }
  }, [invitationToken])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    if (globalError) setGlobalError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setGlobalError('')
    setIsLoading(true)

    try {
      const validatedData = loginSchema.parse(formData)
      const response = await authService.login(validatedData)

      if (response.requires2FA) {
        setRequires2FA(true)
        setUserId(response.userId!)
      } else {
        setUser(response.user!)
        
        // Small delay to ensure cookies are set
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // If there's an invitation token, redirect to accept it
        if (invitationToken) {
          router.push(`/invite/${invitationToken}`)
        } else {
          router.push(redirectTo)
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      if (error.errors) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message
        })
        setErrors(fieldErrors)
      } else {
        setGlobalError(error.message || 'Invalid email or password. Please try again.')
      }
      setIsLoading(false)
    }
  }

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalError('')
    setIsLoading(true)

    try {
      const response = await authService.verify2FA({
        userId,
        token: token2FA,
      })

      setUser(response.user)
      
      if (invitationToken) {
        router.push(`/invite/${invitationToken}`)
      } else {
        router.push(redirectTo)
      }
    } catch (error: any) {
      setGlobalError(error.message || '2FA verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // 2FA View
  if (requires2FA) {
    return (
      <div className="flex min-h-screen">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-chart-3 items-center justify-center p-12">
          <div className="max-w-md text-white">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                <span className="text-2xl font-bold">ft</span>
              </div>
              <span className="text-2xl font-bold">ft_transcendence</span>
            </div>
            
            <h1 className="text-4xl font-bold mb-4">Two-Factor Authentication</h1>
            <p className="text-lg text-white/80">
              Your account is protected with 2FA. Enter the code from your authenticator app to continue.
            </p>
            
            <div className="mt-12 p-6 bg-white/10 rounded-xl backdrop-blur">
              <ShieldIcon className="h-8 w-8 mb-3" />
              <p className="text-sm text-white/90">
                Two-factor authentication adds an extra layer of security to your account by requiring a code from your mobile device.
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - 2FA Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <span className="text-lg font-bold text-white">ft</span>
                </div>
                <span className="text-xl font-bold">ft_transcendence</span>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <ShieldIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Enter Authentication Code</h2>
              <p className="text-muted-foreground mt-2">
                Open your authenticator app and enter the 6-digit code
              </p>
            </div>

            <form onSubmit={handle2FASubmit} className="space-y-6">
              {globalError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircleIcon className="h-5 w-5 shrink-0" />
                  <span>{globalError}</span>
                </div>
              )}

              <div>
                <Input
                  type="text"
                  name="token2FA"
                  value={token2FA}
                  onChange={(e) => setToken2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] h-14 font-mono"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base" 
                disabled={isLoading || token2FA.length !== 6}
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false)
                  setToken2FA('')
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Main Login View
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-chart-3 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <span className="text-2xl font-bold">ft</span>
            </div>
            <span className="text-2xl font-bold">ft_transcendence</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4">Welcome back!</h1>
          <p className="text-lg text-white/80">
            Sign in to continue to your virtual workspace. Your team is waiting for you in the 2D office!
          </p>
          
          <div className="mt-12 grid gap-4">
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                🏢
              </div>
              <div>
                <p className="font-medium">Virtual Office</p>
                <p className="text-sm text-white/70">Walk around and collaborate in real-time</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                ✅
              </div>
              <div>
                <p className="font-medium">Task Management</p>
                <p className="text-sm text-white/70">Kanban boards and sprint planning</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                💬
              </div>
              <div>
                <p className="font-medium">Real-time Chat</p>
                <p className="text-sm text-white/70">Team and direct messaging</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-white">ft</span>
              </div>
              <span className="text-xl font-bold">ft_transcendence</span>
            </div>
          </div>

          {/* Invitation Banner */}
          {invitationInfo && (
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-primary/10 border border-primary/20 p-4">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <BuildingIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-primary">You're invited!</p>
                <p className="text-sm text-muted-foreground">
                  Sign in to join <span className="font-medium">{invitationInfo.workspaceName}</span>
                </p>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-bold">Sign in to your account</h2>
            <p className="text-muted-foreground mt-2">
              Enter your email and password to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {globalError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircleIcon className="h-5 w-5 shrink-0" />
                <span>{globalError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`h-12 ${errors.email ? 'border-destructive' : ''}`}
                readOnly={!!invitedEmail}
                autoFocus={!invitedEmail}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`h-12 ${errors.password ? 'border-destructive' : ''}`}
                autoFocus={!!invitedEmail}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link 
              href={invitationToken ? `/register?invitationToken=${invitationToken}` : '/register'} 
              className="font-medium text-primary hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

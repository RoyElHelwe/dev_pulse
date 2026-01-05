'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authService } from '@/lib/auth-service'
import { registerSchema } from '@/lib/schemas'
import { AlertCircleIcon, CheckCircleIcon, BuildingIcon } from '@/components/ui/icons'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams?.get('invitationToken')
  const emailParam = searchParams?.get('email')

  const [formData, setFormData] = useState({
    name: '',
    email: emailParam || '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)
  const [invitationInfo, setInvitationInfo] = useState<{ 
    workspaceName: string; 
    email: string;
    role: string;
  } | null>(null)

  // If there's an invitation token, fetch the workspace info
  useEffect(() => {
    if (invitationToken) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/invitations/validate/${invitationToken}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.invitation?.workspace) {
            setInvitationInfo({ 
              workspaceName: data.invitation.workspace.name,
              email: data.invitation.email,
              role: data.invitation.role,
            })
            // Pre-fill email from invitation
            if (data.invitation.email) {
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
      // Client-side validation
      if (formData.password !== formData.confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' })
        setIsLoading(false)
        return
      }

      if (formData.password.length < 8) {
        setErrors({ password: 'Password must be at least 8 characters' })
        setIsLoading(false)
        return
      }

      const validatedData = registerSchema.parse({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })

      // Include invitation token if present
      const registerData = {
        ...validatedData,
        ...(invitationToken && { invitationToken }),
      }

      await authService.register(registerData)
      setSuccess(true)

      // Redirect after short delay
      setTimeout(() => {
        if (invitationToken) {
          // If invited, go to login with invitation context
          router.push(`/login?invitationToken=${invitationToken}&email=${encodeURIComponent(formData.email)}`)
        } else {
          router.push('/login')
        }
      }, 2000)
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message
        })
        setErrors(fieldErrors)
      } else {
        setGlobalError(error.message || 'Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Success State
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
            <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-muted-foreground mb-4">
            {invitationToken 
              ? `Redirecting you to sign in and join ${invitationInfo?.workspaceName}...`
              : 'Redirecting you to sign in...'
            }
          </p>
          <div className="flex justify-center">
            <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        </div>
      </div>
    )
  }

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
          
          <h1 className="text-4xl font-bold mb-4">
            {invitationInfo ? `Join ${invitationInfo.workspaceName}` : 'Create your workspace'}
          </h1>
          <p className="text-lg text-white/80">
            {invitationInfo 
              ? `You've been invited to join as a ${invitationInfo.role.toLowerCase()}. Create your account to get started.`
              : 'Join thousands of teams managing their work in a fun, visual 2D office environment.'
            }
          </p>
          
          <div className="mt-12 grid gap-4">
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                🎮
              </div>
              <div>
                <p className="font-medium">2D Virtual Office</p>
                <p className="text-sm text-white/70">Walk around and interact with your team</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                🔐
              </div>
              <div>
                <p className="font-medium">Secure by Default</p>
                <p className="text-sm text-white/70">2FA, OAuth, and encrypted data</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl backdrop-blur">
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                🤖
              </div>
              <div>
                <p className="font-medium">AI-Powered</p>
                <p className="text-sm text-white/70">Auto-generate your office layout</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Register Form */}
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
                  Create an account to join <span className="font-medium">{invitationInfo.workspaceName}</span> as {invitationInfo.role.toLowerCase()}
                </p>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-muted-foreground mt-2">
              Fill in your details to get started
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
              <label htmlFor="name" className="text-sm font-medium">
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className={`h-12 ${errors.name ? 'border-destructive' : ''}`}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

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
                readOnly={!!invitationInfo}
              />
              {invitationInfo && (
                <p className="text-xs text-muted-foreground">
                  This email was specified in your invitation
                </p>
              )}
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`h-12 ${errors.password ? 'border-destructive' : ''}`}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`h-12 ${errors.confirmPassword ? 'border-destructive' : ''}`}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <div className="mt-8 text-center">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link 
              href={invitationToken ? `/login?invitationToken=${invitationToken}` : '/login'} 
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

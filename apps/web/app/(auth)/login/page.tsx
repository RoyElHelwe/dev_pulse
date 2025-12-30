'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { authService } from '@/lib/auth-service'
import { useAuth } from '@/lib/hooks/use-auth'
import { loginSchema } from '@/lib/schemas'
import AuthLayout from '@/components/layout/auth-layout'
import { FormInputField } from '@/components/ui/form-field'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [userId, setUserId] = useState('')
  const [token2FA, setToken2FA] = useState('')

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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setGlobalError('')
    setIsLoading(true)

    try {
      const validatedData = loginSchema.parse(formData)
      const response = await authService.login(validatedData)

      console.log('Login response:', response)

      if (response.requires2FA) {
        setRequires2FA(true)
        setUserId(response.userId!)
      } else {
        console.log('Setting user and redirecting...')
        setUser(response.user!)
        
        // Small delay to ensure cookies are set
        await new Promise(resolve => setTimeout(resolve, 100))
        
        console.log('Redirecting to dashboard')
        router.push('/dashboard')
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
        setGlobalError(error.message || 'Login failed. Please try again.')
      }
    } finally {
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
      router.push('/dashboard')
    } catch (error: any) {
      setGlobalError(error.message || '2FA verification failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (requires2FA) {
    return (
      <AuthLayout title="Two-Factor Authentication" description="Enter the 6-digit code from your authenticator app">
        <form onSubmit={handle2FASubmit} className="space-y-4">
          {globalError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{globalError}</div>
          )}

          <FormInputField
            label="Authentication Code"
            id="token2FA"
            name="token2FA"
            type="text"
            value={token2FA}
            onChange={(e) => setToken2FA(e.target.value)}
            placeholder="000000"
            maxLength={6}
            required
          />

          <Button type="submit" className="w-full" disabled={isLoading || token2FA.length !== 6}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>

          <button
            type="button"
            onClick={() => setRequires2FA(false)}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            Back to login
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome Back" description="Login to your ft_transcendence account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {globalError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{globalError}</div>
        )}

        <FormInputField
          label="Email"
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          error={errors.email}
          required
        />

        <FormInputField
          label="Password"
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          error={errors.password}
          required
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">Don't have an account? </span>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </div>
    </AuthLayout>
  )
}

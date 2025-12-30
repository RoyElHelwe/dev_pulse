'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { authService } from '@/lib/auth-service'
import { registerSchema } from '@/lib/schemas'
import AuthLayout from '@/components/layout/auth-layout'
import { FormInputField } from '@/components/ui/form-field'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)

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
      if (formData.password !== formData.confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' })
        setIsLoading(false)
        return
      }

      const validatedData = registerSchema.parse({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })

      await authService.register(validatedData)

      setSuccess(true)

      setTimeout(() => {
        router.push('/login')
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
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout title="Registration Successful!" description="Your account has been created successfully">
        <div className="text-center">
          <div className="mb-4 text-6xl">✅</div>
          <p className="text-sm text-muted-foreground mb-4">
            Redirecting to login...
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create Account" description="Join ft_transcendence today">
      <form onSubmit={handleSubmit} className="space-y-4">
        {globalError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{globalError}</div>
        )}

        <FormInputField
          label="Full Name"
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="John Doe"
          error={errors.name}
          required
        />

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
          hint="At least 8 characters with uppercase, lowercase, and number"
          required
        />

        <FormInputField
          label="Confirm Password"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="••••••••"
          error={errors.confirmPassword}
          required
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  )
}

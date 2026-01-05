'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { FormField } from '@/components/ui/form-field'

type Step = 1 | 2 | 3 | 4

interface WorkspaceData {
  name: string
  description: string
  teamSize: number
  roles: { role: string; count: number }[]
  preferences: {
    layoutStyle: string
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<WorkspaceData>({
    name: '',
    description: '',
    teamSize: 5,
    roles: [],
    preferences: {
      layoutStyle: 'modern',
    },
  })

  const [roleInputs, setRoleInputs] = useState({
    developers: 0,
    designers: 0,
    managers: 0,
    others: 0,
  })

  const updateData = (field: keyof WorkspaceData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const nextStep = () => {
    setError(null)
    if (step === 1) {
      if (!data.name.trim()) {
        setError('Organization name is required')
        return
      }
    }
    if (step === 2) {
      if (data.teamSize < 1) {
        setError('Team size must be at least 1')
        return
      }
    }
    if (step < 4) setStep((step + 1) as Step)
  }

  const prevStep = () => {
    if (step > 1) setStep((step - 1) as Step)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Build roles array
      const roles = []
      if (roleInputs.developers > 0) roles.push({ role: 'Developer', count: roleInputs.developers })
      if (roleInputs.designers > 0) roles.push({ role: 'Designer', count: roleInputs.designers })
      if (roleInputs.managers > 0) roles.push({ role: 'Manager', count: roleInputs.managers })
      if (roleInputs.others > 0) roles.push({ role: 'Other', count: roleInputs.others })

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          roles,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create workspace')
      }

      const workspace = await response.json()

      // Redirect to office/dashboard
      router.push(`/dashboard`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-2xl">
        <div className="p-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="mb-4 flex justify-between">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    s === step
                      ? 'bg-primary text-white'
                      : s < step
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
              ))}
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Step 1: Organization Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome! Let's set up your workspace</h2>
                <p className="mt-2 text-sm text-gray-600">First, tell us about your organization</p>
              </div>

              <FormField label="Organization Name" required>
                <Input
                  placeholder="Acme Inc"
                  value={data.name}
                  onChange={e => updateData('name', e.target.value)}
                  autoFocus
                />
              </FormField>

              <FormField label="Description (optional)">
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What does your organization do?"
                  rows={3}
                  value={data.description}
                  onChange={e => updateData('description', e.target.value)}
                />
              </FormField>
            </div>
          )}

          {/* Step 2: Team Size */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Team Size</h2>
                <p className="mt-2 text-sm text-gray-600">How many people will be in your workspace?</p>
              </div>

              <FormField label="Number of Team Members" required>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={data.teamSize}
                  onChange={e => updateData('teamSize', parseInt(e.target.value) || 0)}
                  autoFocus
                />
              </FormField>

              <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
                💡 We'll generate an optimal office layout based on your team size
              </div>
            </div>
          )}

          {/* Step 3: Roles Breakdown */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Team Roles</h2>
                <p className="mt-2 text-sm text-gray-600">Break down your team by roles (optional but recommended)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="👨‍💻 Developers">
                  <Input
                    type="number"
                    min="0"
                    value={roleInputs.developers}
                    onChange={e => setRoleInputs(prev => ({ ...prev, developers: parseInt(e.target.value) || 0 }))}
                  />
                </FormField>

                <FormField label="🎨 Designers">
                  <Input
                    type="number"
                    min="0"
                    value={roleInputs.designers}
                    onChange={e => setRoleInputs(prev => ({ ...prev, designers: parseInt(e.target.value) || 0 }))}
                  />
                </FormField>

                <FormField label="👔 Managers">
                  <Input
                    type="number"
                    min="0"
                    value={roleInputs.managers}
                    onChange={e => setRoleInputs(prev => ({ ...prev, managers: parseInt(e.target.value) || 0 }))}
                  />
                </FormField>

                <FormField label="👥 Others">
                  <Input
                    type="number"
                    min="0"
                    value={roleInputs.others}
                    onChange={e => setRoleInputs(prev => ({ ...prev, others: parseInt(e.target.value) || 0 }))}
                  />
                </FormField>
              </div>

              <div className="text-sm text-gray-600">
                Total: {Object.values(roleInputs).reduce((sum, val) => sum + val, 0)} people
                {Object.values(roleInputs).reduce((sum, val) => sum + val, 0) !== data.teamSize && (
                  <span className="ml-2 text-yellow-600">
                    (Doesn't match team size of {data.teamSize})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Preferences */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Office Style</h2>
                <p className="mt-2 text-sm text-gray-600">Choose your preferred office layout</p>
              </div>

              <div className="grid gap-4">
                {[
                  { value: 'modern', label: 'Modern', emoji: '🏢', desc: 'Open space, collaborative' },
                  { value: 'cozy', label: 'Cozy', emoji: '🏡', desc: 'Comfortable, relaxed' },
                  { value: 'minimal', label: 'Minimal', emoji: '⬜', desc: 'Clean, simple' },
                ].map(style => (
                  <button
                    key={style.value}
                    className={`flex items-center gap-4 rounded-lg border-2 p-4 text-left transition-all ${
                      data.preferences.layoutStyle === style.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => updateData('preferences', { layoutStyle: style.value })}
                  >
                    <span className="text-4xl">{style.emoji}</span>
                    <div>
                      <div className="font-semibold">{style.label}</div>
                      <div className="text-sm text-gray-600">{style.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
                ✅ Ready to create your workspace!
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 1 || loading}
            >
              Back
            </Button>

            {step < 4 ? (
              <Button onClick={nextStep} disabled={loading}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <LoadingSpinner message="Creating..." /> : 'Create Workspace'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

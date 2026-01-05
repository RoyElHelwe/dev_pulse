'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  AlertCircleIcon, 
  CheckCircleIcon, 
  MailIcon, 
  CopyIcon,
  UserPlusIcon,
  ChevronRightIcon
} from '@/components/ui/icons'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import Link from 'next/link'

interface WorkspaceInfo {
  id: string
  name: string
  isOwner: boolean
}

interface InviteResult {
  success: boolean
  email: string
  inviteUrl?: string
  error?: string
}

export default function InvitePage() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    checkOwnership()
  }, [])

  const checkOwnership = async () => {
    try {
      const res = await fetch('http://localhost:4000/workspaces/status', {
        credentials: 'include',
      })

      if (!res.ok) {
        router.push('/dashboard')
        return
      }

      const data = await res.json()
      
      if (!data.hasWorkspace) {
        router.push('/onboarding')
        return
      }

      // Only OWNER can invite
      if (!data.isOwner && data.role !== 'OWNER') {
        router.push('/team')
        return
      }

      setWorkspace({
        id: data.workspace.id,
        name: data.workspace.name,
        isOwner: true,
      })
    } catch (error) {
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    setSending(true)

    try {
      const res = await fetch(`http://localhost:4000/invitations/${workspace?.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.toLowerCase(), role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({
          success: false,
          email,
          error: data.message || 'Failed to send invitation',
        })
      } else {
        setResult({
          success: true,
          email,
          inviteUrl: data.inviteUrl,
        })
        setEmail('')
      }
    } catch (error) {
      setResult({
        success: false,
        email,
        error: 'Failed to send invitation. Please try again.',
      })
    } finally {
      setSending(false)
    }
  }

  const copyInviteLink = async () => {
    if (result?.inviteUrl) {
      await navigator.clipboard.writeText(result.inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner message="Loading..." />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/team" className="hover:text-foreground">
            Team
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-foreground">Invite Members</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Invite Team Members</h1>
          <p className="text-muted-foreground mt-2">
            Send invitations to add people to <span className="font-medium">{workspace?.name}</span>
          </p>
        </div>

        {/* Invite Form */}
        <Card className="p-6">
          <form onSubmit={handleInvite} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="flex gap-3">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1 h-12"
                  required
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="h-12 rounded-lg border border-input bg-background px-4 text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                An invitation email will be sent with a unique link
              </p>
            </div>

            <Button type="submit" className="w-full h-12" disabled={sending || !email}>
              {sending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending invitation...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <MailIcon className="h-5 w-5" />
                  Send Invitation
                </span>
              )}
            </Button>
          </form>

          {/* Result Message */}
          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.success 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-destructive/10 border border-destructive/20'
            }`}>
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircleIcon className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  {result.success ? (
                    <>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Invitation sent!
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        An invitation email has been sent to <span className="font-medium">{result.email}</span>
                      </p>
                      
                      {result.inviteUrl && (
                        <div className="mt-4 p-3 bg-white dark:bg-background rounded-lg border">
                          <p className="text-xs text-muted-foreground mb-2">
                            Or share this link directly:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-muted p-2 rounded truncate">
                              {result.inviteUrl}
                            </code>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={copyInviteLink}
                            >
                              {copied ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                              ) : (
                                <CopyIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-destructive">
                        Invitation failed
                      </p>
                      <p className="text-sm text-destructive/80 mt-1">
                        {result.error}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <h3 className="font-semibold mb-3">📋 How invitations work</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Each invitation is unique and tied to a specific email address
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Invitations expire after 7 days
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              New users will be prompted to create an account
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Existing users will be asked to sign in first
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              Users can only belong to one workspace at a time
            </li>
          </ul>
        </Card>

        {/* Back Link */}
        <div className="text-center">
          <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Team
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useAuth } from '@/lib/hooks/use-auth'
import { 
  BuildingIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  AlertCircleIcon,
  ClockIcon
} from '@/components/ui/icons'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type InvitationState = 
  | 'loading'
  | 'valid-needs-login'     
  | 'valid-needs-register'  
  | 'valid-can-accept'      
  | 'invalid-expired'       
  | 'invalid-used'          
  | 'invalid-declined'      
  | 'invalid-not-found'     
  | 'invalid-has-workspace' 
  | 'invalid-wrong-email'   
  | 'error'                 

interface InvitationData {
  id: string
  email: string
  role: string
  workspace: {
    id: string
    name: string
    slug: string
    image?: string
  }
}

interface ValidationResponse {
  valid: boolean
  userExists?: boolean
  needsLogin?: boolean
  needsRegistration?: boolean
  invitation?: InvitationData
  message?: string
  errorCode?: string
}

export default function InviteAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string
  const { user, isAuthenticated, isLoading: authLoading, checkAuth, logout } = useAuth()

  const [state, setState] = useState<InvitationState>('loading')
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)

  useEffect(() => {
    if (token && !authLoading) {
      validateInvitation()
    }
  }, [token, authLoading, isAuthenticated])

  const validateInvitation = async () => {
    setState('loading')
    setError('')

    try {
      const res = await fetch(`${API_BASE_URL}/invitations/validate/${token}`)
      const data: ValidationResponse = await res.json()

      if (!res.ok || !data.valid) {
        handleInvalidResponse(data)
        return
      }

      setInvitation(data.invitation || null)

      if (isAuthenticated && user) {
        if (data.invitation && user.email.toLowerCase() !== data.invitation.email.toLowerCase()) {
          setState('invalid-wrong-email')
          setError(`This invitation was sent to ${data.invitation.email}. You are logged in as ${user.email}.`)
          return
        }
        setState('valid-can-accept')
      } else {
        setState(data.needsLogin ? 'valid-needs-login' : 'valid-needs-register')
      }
    } catch (err) {
      console.error('Validation error:', err)
      setState('error')
      setError('Failed to validate invitation. Please try again.')
    }
  }

  const handleInvalidResponse = (data: ValidationResponse) => {
    setInvitation(data.invitation || null)
    
    if (data.errorCode === 'USER_HAS_WORKSPACE') {
      setState('invalid-has-workspace')
      setError(data.message || 'You are already a member of another workspace.')
    } else if (data.message?.includes('expired')) {
      setState('invalid-expired')
    } else if (data.message?.includes('accepted')) {
      setState('invalid-used')
    } else if (data.message?.includes('declined')) {
      setState('invalid-declined')
    } else {
      setState('invalid-not-found')
    }
  }

  const handleAccept = async () => {
    setAccepting(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE_URL}/invitations/accept/${token}`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to accept invitation')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
      setAccepting(false)
    }
  }

  const handleDecline = async () => {
    setDeclining(true)

    try {
      await fetch(`${API_BASE_URL}/invitations/decline/${token}`, { method: 'POST' })
      setState('invalid-declined')
    } catch {
      setError('Failed to decline invitation')
      setDeclining(false)
    }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-chart-3/5">
        <LoadingSpinner message="Validating invitation..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-chart-3/5 p-4">
      <Card className="w-full max-w-lg p-8">
        {invitation && (
          <div className="flex items-center gap-4 mb-6 pb-6 border-b">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <BuildingIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{invitation.workspace.name}</h2>
              <p className="text-sm text-muted-foreground">
                Invited as <Badge variant="secondary">{invitation.role}</Badge>
              </p>
            </div>
          </div>
        )}

        {state === 'valid-can-accept' && (
          <>
            <div className="text-center mb-6">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold">Accept Invitation?</h3>
              <p className="text-muted-foreground mt-2">
                Hi {user?.name}! Join {invitation?.workspace.name}.
              </p>
            </div>
            {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={handleDecline} disabled={declining || accepting}>
                {declining ? 'Declining...' : 'Decline'}
              </Button>
              <Button className="flex-1 h-12" onClick={handleAccept} disabled={accepting || declining}>
                {accepting ? 'Joining...' : 'Accept & Join'}
              </Button>
            </div>
          </>
        )}

        {state === 'valid-needs-login' && (
          <>
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block"></span>
              <h3 className="text-lg font-semibold">Sign In Required</h3>
              <p className="text-muted-foreground mt-2">
                Sign in with <span className="font-medium">{invitation?.email}</span>
              </p>
            </div>
            <Link href={`/login?invitationToken=${token}&email=${encodeURIComponent(invitation?.email || '')}`}>
              <Button className="w-full h-12">Sign In to Continue</Button>
            </Link>
          </>
        )}

        {state === 'valid-needs-register' && (
          <>
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block"></span>
              <h3 className="text-lg font-semibold">Create Your Account</h3>
              <p className="text-muted-foreground mt-2">
                Create account with <span className="font-medium">{invitation?.email}</span>
              </p>
            </div>
            <Link href={`/register?invitationToken=${token}&email=${encodeURIComponent(invitation?.email || '')}`}>
              <Button className="w-full h-12">Create Account</Button>
            </Link>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Have an account? <Link href={`/login?invitationToken=${token}`} className="text-primary hover:underline">Sign in</Link>
            </p>
          </>
        )}

        {state === 'invalid-wrong-email' && (
          <>
            <div className="text-center mb-6">
              <AlertCircleIcon className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
              <h3 className="text-lg font-semibold">Wrong Account</h3>
              <p className="text-muted-foreground mt-2">{error}</p>
            </div>
            <Button variant="outline" className="w-full h-12 mb-3" onClick={async () => { await logout(); validateInvitation() }}>
              Sign out and switch account
            </Button>
          </>
        )}

        {state === 'invalid-expired' && (
          <>
            <div className="text-center mb-6">
              <ClockIcon className="h-12 w-12 mx-auto text-orange-600 mb-4" />
              <h3 className="text-lg font-semibold">Invitation Expired</h3>
              <p className="text-muted-foreground mt-2">Ask the workspace owner for a new invitation.</p>
            </div>
            <Link href="/"><Button variant="outline" className="w-full h-12">Go to Homepage</Button></Link>
          </>
        )}

        {state === 'invalid-used' && (
          <>
            <div className="text-center mb-6">
              <CheckCircleIcon className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-semibold">Already Accepted</h3>
              <p className="text-muted-foreground mt-2">Sign in to access your workspace.</p>
            </div>
            <Link href="/login"><Button className="w-full h-12">Sign In</Button></Link>
          </>
        )}

        {state === 'invalid-declined' && (
          <>
            <div className="text-center mb-6">
              <XCircleIcon className="h-12 w-12 mx-auto text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold">Invitation Declined</h3>
            </div>
            <Link href="/"><Button variant="outline" className="w-full h-12">Go to Homepage</Button></Link>
          </>
        )}

        {state === 'invalid-not-found' && (
          <>
            <div className="text-center mb-6">
              <XCircleIcon className="h-12 w-12 mx-auto text-red-600 mb-4" />
              <h3 className="text-lg font-semibold">Invalid Invitation</h3>
              <p className="text-muted-foreground mt-2">This link is invalid or expired.</p>
            </div>
            <Link href="/"><Button variant="outline" className="w-full h-12">Go to Homepage</Button></Link>
          </>
        )}

        {state === 'invalid-has-workspace' && (
          <>
            <div className="text-center mb-6">
              <AlertCircleIcon className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
              <h3 className="text-lg font-semibold">Already in a Workspace</h3>
              <p className="text-muted-foreground mt-2">{error}</p>
            </div>
            <Link href={isAuthenticated ? "/dashboard" : "/login"}>
              <Button className="w-full h-12">{isAuthenticated ? "Go to Your Workspace" : "Sign In"}</Button>
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-center mb-6">
              <AlertCircleIcon className="h-12 w-12 mx-auto text-red-600 mb-4" />
              <h3 className="text-lg font-semibold">Something Went Wrong</h3>
              <p className="text-muted-foreground mt-2">{error}</p>
            </div>
            <Button onClick={validateInvitation} className="w-full h-12 mb-3">Try Again</Button>
            <Link href="/"><Button variant="outline" className="w-full h-12">Go to Homepage</Button></Link>
          </>
        )}
      </Card>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { authService } from '@/lib/auth-service'
import { useAuth } from '@/lib/hooks/use-auth'
import type { UserSession } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { FormInputField } from '@/components/ui/form-field'

export default function SecuritySettingsPage() {
  const { user, checkAuth, isAuthenticated } = useAuth()
  
  // 2FA State
  const [qrCode, setQrCode] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState('')
  const [is2FALoading, setIs2FALoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('')
  
  // Sessions State
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const sessionsLoadedRef = useRef(false)

  const loadSessions = useCallback(async () => {
    try {
      setSessionsLoading(true)
      setSessionError('')
      const data = await authService.getSessions()
      setSessions(data)
    } catch (error: any) {
      setSessionError(error.message || 'Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // Load sessions once when authenticated
  useEffect(() => {
    if (isAuthenticated && !sessionsLoadedRef.current) {
      sessionsLoadedRef.current = true
      loadSessions()
    }
  }, [isAuthenticated, loadSessions])

  const handleSetup2FA = async () => {
    try {
      setIs2FALoading(true)
      setTwoFactorError('')
      const data = await authService.setup2FA()
      setQrCode(data.qrCode)
      setSecret(data.secret)
    } catch (error: any) {
      setTwoFactorError(error.message || 'Failed to setup 2FA')
    } finally {
      setIs2FALoading(false)
    }
  }

  const handleEnable2FA = async () => {
    try {
      setIs2FALoading(true)
      setTwoFactorError('')
      setTwoFactorSuccess('')
      
      await authService.enable2FA(verificationCode)
      
      setTwoFactorSuccess('2FA enabled successfully!')
      setQrCode('')
      setSecret('')
      setVerificationCode('')
      
      // Refresh user data
      await checkAuth()
    } catch (error: any) {
      setTwoFactorError(error.message || 'Failed to enable 2FA')
    } finally {
      setIs2FALoading(false)
    }
  }

  const handleDisable2FA = async () => {
    const code = prompt('Enter your 6-digit 2FA code to disable:')
    if (!code) {
      return
    }

    try {
      setIs2FALoading(true)
      setTwoFactorError('')
      setTwoFactorSuccess('')
      
      await authService.disable2FA(code)
      
      setTwoFactorSuccess('2FA disabled successfully!')
      
      // Refresh user data
      await checkAuth()
    } catch (error: any) {
      setTwoFactorError(error.message || 'Failed to disable 2FA')
    } finally {
      setIs2FALoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent) {
      if (!confirm('Are you sure you want to revoke your current session? You will be logged out immediately.')) {
        return
      }
    } else {
      if (!confirm('Are you sure you want to revoke this session?')) {
        return
      }
    }

    try {
      await authService.revokeSession(sessionId)
      
      if (isCurrent) {
        // Redirect to login page after revoking current session
        window.location.href = '/login'
      } else {
        await loadSessions()
      }
    } catch (error: any) {
      setSessionError(error.message || 'Failed to revoke session')
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to revoke all other sessions? You will remain logged in on this device.')) {
      return
    }

    try {
      await authService.revokeAllSessions()
      await loadSessions()
    } catch (error: any) {
      setSessionError(error.message || 'Failed to revoke sessions')
    }
  }

  // If user data hasn't loaded yet
  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner message="Loading..." />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
        <h2 className="text-3xl font-bold text-foreground mb-8">Security Settings</h2>

        {/* Two-Factor Authentication Section */}
        <Card title="Two-Factor Authentication" className="mb-8">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Status: {user.twoFactorEnabled ? (
                <span className="font-medium text-green-600">✓ Enabled</span>
              ) : (
                <span className="font-medium text-yellow-600">✗ Disabled</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication adds an extra layer of security to your account.
            </p>
          </div>

          {twoFactorError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {twoFactorError}
            </div>
          )}

          {twoFactorSuccess && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
              {twoFactorSuccess}
            </div>
          )}

          {!user.twoFactorEnabled && !qrCode && (
            <Button onClick={handleSetup2FA} disabled={is2FALoading}>
              {is2FALoading ? 'Setting up...' : 'Enable 2FA'}
            </Button>
          )}

          {qrCode && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">1. Scan this QR code with your authenticator app:</p>
                <div className="bg-background p-4 rounded-(--radius) border border-border inline-block">
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">2. Or manually enter this secret:</p>
                <code className="bg-muted px-3 py-2 rounded-(--radius) text-sm font-mono">{secret}</code>
              </div>

              <div>
                <FormInputField
                  label="3. Enter the 6-digit code from your app:"
                  id="verificationCode"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="max-w-xs"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleEnable2FA} disabled={is2FALoading || verificationCode.length !== 6}>
                  {is2FALoading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQrCode('')
                    setSecret('')
                    setVerificationCode('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {user.twoFactorEnabled && (
            <Button onClick={handleDisable2FA} variant="destructive" disabled={is2FALoading}>
              {is2FALoading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          )}
        </Card>

        {/* Active Sessions Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-card-foreground">Active Sessions</h3>
            {sessions.length > 1 && (
              <Button onClick={handleRevokeAllSessions} variant="outline" size="sm">
                Revoke All Others
              </Button>
            )}
          </div>

          {sessionError && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {sessionError}
            </div>
          )}

          {sessionsLoading ? (
            <div className="text-center py-8">
              <LoadingSpinner size="sm" message="Loading sessions..." />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div 
                  key={session.id} 
                  className={`border rounded-lg p-4 transition-colors ${
                    session.isCurrent 
                      ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' 
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {session.deviceInfo?.includes('Windows') ? '🖥️' :
                             session.deviceInfo?.includes('macOS') ? '💻' :
                             session.deviceInfo?.includes('Linux') ? '🐧' :
                             session.deviceInfo?.includes('Android') ? '📱' :
                             session.deviceInfo?.includes('iOS') || session.deviceInfo?.includes('iPhone') ? '📱' : '🌐'}
                          </span>
                          <span className="font-medium text-foreground">
                            {session.deviceInfo || 'Unknown Device'}
                          </span>
                        </div>
                        {session.isCurrent && (
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-md font-medium">
                            This device
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <span className="font-medium text-foreground">IP:</span>
                          <span>{session.ipAddress}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-medium text-foreground">Last active:</span>
                          <span>{new Date(session.lastActivityAt).toLocaleString()}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-medium text-foreground">Expires:</span>
                          <span>{new Date(session.expiresAt).toLocaleString()}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="font-medium text-foreground">Created:</span>
                          <span>{new Date(session.createdAt).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        onClick={() => handleRevokeSession(session.id, session.isCurrent)}
                        variant="outline"
                        size="sm"
                        className="ml-4"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
  )
}

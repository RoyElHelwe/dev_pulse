'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/hooks/use-auth'
import { UsersIcon, UserPlusIcon, CheckCircleIcon, ClockIcon } from '@/components/ui/icons'
import { getRolePermissions } from '@/lib/types'
import { useOnlineStatusContext } from '@/lib/contexts/online-status-context'
import Link from 'next/link'

interface WorkspaceData {
  id: string
  name: string
  description?: string
  memberCount: number
  pendingInvitations: number
  role: string
  isOwner: boolean
}

interface MemberData {
  id: string
  userId: string
  role: string
  status: string
  user?: {
    name: string
    email: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { isUserOnline, onlineUserIds, isConnected } = useOnlineStatusContext()
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [members, setMembers] = useState<MemberData[]>([])
  const [loading, setLoading] = useState(true)

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] 🔄 Online status:', {
      connected: isConnected,
      onlineCount: onlineUserIds.length,
      users: onlineUserIds
    })
  }, [onlineUserIds, isConnected])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch workspace status
        const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces/status`, {
          credentials: 'include',
        })
        
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          
          // Check role-based access
          const permissions = getRolePermissions(statusData.role)
          if (!permissions.canAccessDashboard) {
            router.push('/team')
            return
          }
          
          if (statusData.hasWorkspace) {
            setWorkspace({
              id: statusData.workspace.id,
              name: statusData.workspace.name,
              description: statusData.workspace.description,
              memberCount: statusData.workspace.memberCount || 1,
              pendingInvitations: statusData.workspace.pendingInvitations || 0,
              role: statusData.role,
              isOwner: statusData.isOwner || statusData.role === 'OWNER',
            })

            // Fetch members
            const membersRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${statusData.workspace.id}/members`,
              { credentials: 'include' }
            )
            if (membersRes.ok) {
              const membersData = await membersRes.json()
              setMembers(membersData.slice(0, 5)) // Show top 5 members
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-2">
            Here's what's happening in your workspace today
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <UsersIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workspace?.memberCount || 0}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <span className="text-xl">🟢</span>
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineUserIds.length}</p>
                <p className="text-sm text-muted-foreground">Online Now</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workspace?.pendingInvitations || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Invites</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <span className="text-xl">🏢</span>
              </div>
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Team Overview */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Team Members</h2>
                <p className="text-sm text-muted-foreground">
                  People in your workspace
                </p>
              </div>
              {workspace?.isOwner && (
                <Link href="/team/invite">
                  <Button size="sm">
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </Link>
              )}
            </div>

            {members.length > 0 ? (
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-accent/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar 
                        name={member.user?.name || 'User'} 
                        size="md"
                        showStatus
                        status={isUserOnline(member.userId) ? 'online' : 'offline'}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{member.user?.name || 'Unknown'}</p>
                          {isUserOnline(member.userId) && (
                            <span className="text-xs text-green-500">● Online</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>
                    <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No team members yet</p>
                {workspace?.isOwner && (
                  <Link href="/team/invite">
                    <Button variant="outline" size="sm" className="mt-4">
                      Invite your first team member
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {members.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link href="/team">
                  <Button variant="ghost" className="w-full">
                    View all team members
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            
            <div className="space-y-3">
              <Link href="/workspace" className="block">
                <div className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    🏢
                  </div>
                  <div>
                    <p className="font-medium">Enter Office</p>
                    <p className="text-xs text-muted-foreground">Open 2D virtual office</p>
                  </div>
                </div>
              </Link>

              {workspace?.isOwner && (
                <Link href="/team/invite" className="block">
                  <div className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <UserPlusIcon className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Invite Team</p>
                      <p className="text-xs text-muted-foreground">Add new members</p>
                    </div>
                  </div>
                </Link>
              )}

              <Link href="/settings" className="block">
                <div className="flex items-center gap-3 p-4 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    ⚙️
                  </div>
                  <div>
                    <p className="font-medium">Settings</p>
                    <p className="text-xs text-muted-foreground">Account & security</p>
                  </div>
                </div>
              </Link>
            </div>

            {/* Your Role */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground mb-2">Your Role</p>
              <Badge variant={workspace?.isOwner ? 'default' : 'secondary'} size="md">
                {workspace?.role || 'Member'}
              </Badge>
            </div>
          </Card>
        </div>

        {/* Coming Soon Features */}
        <Card className="p-6 bg-gradient-to-r from-primary/5 to-chart-3/5 border-primary/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">🎮 2D Virtual Office Coming Soon!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Walk around, voice chat with proximity audio, and collaborate in real-time.
              </p>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </Card>
      </div>
  )
}

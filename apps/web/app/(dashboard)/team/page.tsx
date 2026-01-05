'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownTrigger, 
  DropdownContent, 
  DropdownItem,
  DropdownSeparator
} from '@/components/ui/dropdown-menu'
import { UserPlusIcon, ChevronDownIcon, TrashIcon, ShieldIcon } from '@/components/ui/icons'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOnlineStatusContext } from '@/lib/contexts/online-status-context'
import Link from 'next/link'

interface Member {
  id: string
  userId: string
  role: string
  status: string
  joinedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
}

interface WorkspaceInfo {
  id: string
  name: string
  isOwner: boolean
}

export default function TeamPage() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'members' | 'pending'>('members')
  const { isUserOnline, onlineUserIds, isConnected } = useOnlineStatusContext()

  // Debug logging - track changes
  useEffect(() => {
    console.log('[TeamPage] 🔄 Context updated:')
    console.log('  - Connected:', isConnected)
    console.log('  - Online users:', onlineUserIds)
    console.log('  - Online count:', onlineUserIds.length)
  }, [onlineUserIds, isConnected])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Get workspace info
      const statusRes = await fetch('http://localhost:4000/workspaces/status', {
        credentials: 'include',
      })
      
      if (!statusRes.ok) return

      const statusData = await statusRes.json()
      if (!statusData.hasWorkspace) return

      setWorkspace({
        id: statusData.workspace.id,
        name: statusData.workspace.name,
        isOwner: statusData.isOwner || statusData.role === 'OWNER',
      })

      // Fetch members
      const membersRes = await fetch(
        `http://localhost:4000/workspaces/${statusData.workspace.id}/members`,
        { credentials: 'include' }
      )
      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setMembers(membersData)
      }

      // Fetch pending invitations (owner only)
      if (statusData.isOwner || statusData.role === 'OWNER') {
        const invitesRes = await fetch(
          `http://localhost:4000/invitations/workspace/${statusData.workspace.id}`,
          { credentials: 'include' }
        )
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json()
          setInvitations(invitesData)
        }
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (res.ok) {
        setInvitations(prev => prev.filter(i => i.id !== invitationId))
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER': return 'default'
      case 'ADMIN': return 'warning'
      case 'MANAGER': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusColor = (status: string, userId: string) => {
    // Check real-time online status first
    if (isUserOnline(userId)) {
      return 'online'
    }
    // Fall back to stored status
    switch (status) {
      case 'ONLINE': return 'online'
      case 'AWAY': return 'away'
      case 'BUSY': return 'busy'
      default: return 'offline'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner message="Loading team..." />
      </div>
    )
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Team</h1>
            <p className="text-muted-foreground mt-1">
              Manage your workspace members
            </p>
            {/* Debug: Connection status */}
            <p className="text-xs mt-1">
              <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
                {isConnected ? '● Connected' : '○ Disconnected'}
              </span>
              <span className="text-muted-foreground ml-2">
                ({onlineUserIds.length} online)
              </span>
            </p>
          </div>
          
          {workspace?.isOwner && (
            <Link href="/team/invite">
              <Button>
                <UserPlusIcon className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'members'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Members ({members.length})
          </button>
          {workspace?.isOwner && (
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'pending'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pending ({invitations.length})
            </button>
          )}
        </div>

        {/* Members List */}
        {activeTab === 'members' && (
          <Card className="divide-y divide-border">
            {members.length > 0 ? (
              members.map((member) => {
                const isOnline = isUserOnline(member.userId)
                console.log(`[TeamPage] Member ${member.user?.name} (${member.userId}): ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
                
                return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={member.user?.name || 'User'}
                      size="md"
                      showStatus
                      status={getStatusColor(member.status, member.userId)}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.user?.name || 'Unknown'}</p>
                        {isOnline && (
                          <span className="text-xs text-green-500 font-bold">● Online</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant={getRoleBadgeVariant(member.role)}>
                      {member.role}
                    </Badge>
                    
                    {workspace?.isOwner && member.role !== 'OWNER' && (
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDownIcon className="h-4 w-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem>
                            <ShieldIcon className="h-4 w-4" />
                            Change Role
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem destructive>
                            <TrashIcon className="h-4 w-4" />
                            Remove from Team
                          </DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                )
              })
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">No team members found</p>
              </div>
            )}
          </Card>
        )}

        {/* Pending Invitations */}
        {activeTab === 'pending' && workspace?.isOwner && (
          <Card className="divide-y divide-border">
            {invitations.length > 0 ? (
              invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar name={invitation.email} size="md" />
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited as {invitation.role.toLowerCase()} • Expires{' '}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant="warning">Pending</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvitation(invitation.id)}
                    >
                      <TrashIcon className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No pending invitations</p>
                <Link href="/team/invite">
                  <Button variant="outline" size="sm">
                    Invite team members
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        )}
      </div>
  )
}

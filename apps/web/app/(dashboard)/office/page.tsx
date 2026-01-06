'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VirtualOffice } from '@/components/game/VirtualOffice'
import { useOfficeSocket } from '@/lib/hooks/use-office-socket'
import { useAuth } from '@/lib/hooks/use-auth'
import { PlayerData, Position, PlayerDirection } from '@/lib/game/types'

export default function OfficePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Fetch workspace info
  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces/status`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.hasWorkspace) {
            setWorkspaceId(data.workspace.id)
          } else {
            router.push('/onboarding')
          }
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
      } finally {
        setLoading(false)
      }
    }
    
    if (isAuthenticated && !authLoading) {
      fetchWorkspace()
    }
  }, [isAuthenticated, authLoading, router])
  
  const {
    isConnected,
    players,
    sendPosition,
    sendStatus,
  } = useOfficeSocket({
    workspaceId: workspaceId || '',
    userId: user?.id || '',
    enabled: !!workspaceId && !!user?.id,
  })
  
  // Convert Map to array for the game
  const playerList = useMemo(() => Array.from(players.values()), [players])
  
  const handlePlayerMove = (position: Position, direction: PlayerDirection) => {
    sendPosition(position, direction)
  }
  
  const handleReady = () => {
    console.log('Virtual office ready')
  }
  
  // Show loading while auth or workspace is loading
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Virtual Office...</p>
        </div>
      </div>
    )
  }
  
  // Redirect if not authenticated
  if (!isAuthenticated || !user) {
    router.push('/login')
    return null
  }
  
  // Wait for workspace
  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Setting up workspace...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Virtual Office</h1>
            <p className="text-sm text-gray-500">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Connected • {players.size + 1} people online
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  Connecting...
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Status selector */}
            <select
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="available"
              onChange={(e) => sendStatus(e.target.value)}
            >
              <option value="available">🟢 Available</option>
              <option value="busy">🔴 Busy</option>
              <option value="away">🟡 Away</option>
              <option value="dnd">⛔ Do Not Disturb</option>
            </select>
            
            {/* User info */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                {user.name?.charAt(0) || user.email.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-700">{user.name || user.email}</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Online users sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Online ({players.size + 1})
            </h2>
            
            {/* Current user */}
            <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 mb-2">
              <div className="relative">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {user.name?.charAt(0) || user.email.charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name || user.email} (you)</p>
                <p className="text-xs text-gray-500">Available</p>
              </div>
            </div>
            
            {/* Other users */}
            {playerList.map((player) => (
              <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div className="relative">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: player.avatarColor || '#6366f1' }}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <span 
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      player.status === 'available' ? 'bg-green-500' :
                      player.status === 'busy' ? 'bg-red-500' :
                      player.status === 'away' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}
                  ></span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{player.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{player.status || 'Available'}</p>
                </div>
              </div>
            ))}
            
            {playerList.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No other users online</p>
            )}
          </div>
        </aside>
        
        {/* Game container */}
        <main className="flex-1 p-6 overflow-hidden">
          <VirtualOffice
            userId={user.id}
            username={user.name || user.email}
            email={user.email}
            workspaceId={workspaceId}
            onPlayerMove={handlePlayerMove}
            onReady={handleReady}
            className="w-full h-full"
          />
        </main>
      </div>
    </div>
  )
}

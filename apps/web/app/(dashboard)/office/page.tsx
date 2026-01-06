'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { VirtualOffice } from '@/components/game/VirtualOffice'
import { useOfficeSocket } from '@/lib/hooks/use-office-socket'
import { useAuth } from '@/lib/hooks/use-auth'
import { PlayerData, Position, PlayerDirection, getAvatarColor } from '@/lib/game/types'

export default function OfficePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  
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
  
  const avatarColor = user?.id ? getAvatarColor(user.id) : '#6366f1'
  
  const {
    isConnected,
    players,
    nearbyPlayers,
    chatMessages,
    pendingInteractions,
    sendPosition,
    sendStatus,
    sendChat,
    sendInteraction,
    clearInteraction,
  } = useOfficeSocket({
    workspaceId: workspaceId || '',
    userId: user?.id || '',
    userName: user?.name || user?.email || '',
    userEmail: user?.email,
    avatarColor,
    enabled: !!workspaceId && !!user?.id,
  })
  
  // Convert Map to array for the game
  const playerList = useMemo(() => Array.from(players.values()), [players])
  
  // Get nearby player details
  const nearbyPlayerList = useMemo(() => {
    return Array.from(nearbyPlayers)
      .map(id => players.get(id))
      .filter((p): p is PlayerData => !!p)
  }, [nearbyPlayers, players])
  
  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])
  
  const handlePlayerMove = (position: Position, direction: PlayerDirection) => {
    sendPosition(position, direction)
  }
  
  const handleReady = () => {
    console.log('Virtual office ready')
  }
  
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (chatInput.trim()) {
      sendChat(chatInput.trim())
      setChatInput('')
    }
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
        <main className="flex-1 p-6 overflow-hidden relative">
          <VirtualOffice
            userId={user.id}
            username={user.name || user.email}
            email={user.email}
            workspaceId={workspaceId}
            players={playerList}
            onPlayerMove={handlePlayerMove}
            onReady={handleReady}
            className="w-full h-full"
          />
          
          {/* Proximity Interaction Panel */}
          {nearbyPlayerList.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-gray-200 p-4 min-w-[300px]">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Nearby ({nearbyPlayerList.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {nearbyPlayerList.map(player => (
                  <div key={player.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: player.avatarColor || '#6366f1' }}
                    >
                      {player.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{player.name}</span>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => sendInteraction(player.id, 'wave')}
                        className="p-1.5 bg-yellow-100 hover:bg-yellow-200 rounded-md text-yellow-600 transition-colors"
                        title="Wave"
                      >
                        👋
                      </button>
                      <button
                        onClick={() => sendInteraction(player.id, 'call-request')}
                        className="p-1.5 bg-green-100 hover:bg-green-200 rounded-md text-green-600 transition-colors"
                        title="Request Call"
                      >
                        📞
                      </button>
                      <button
                        onClick={() => sendInteraction(player.id, 'pong-invite')}
                        className="p-1.5 bg-purple-100 hover:bg-purple-200 rounded-md text-purple-600 transition-colors"
                        title="Invite to Pong"
                      >
                        🎮
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Quick Chat */}
              <form onSubmit={handleSendChat} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          )}
          
          {/* Incoming Interactions */}
          {pendingInteractions.length > 0 && (
            <div className="absolute top-8 right-8 flex flex-col gap-2">
              {pendingInteractions.map((interaction, idx) => (
                <div 
                  key={`${interaction.senderId}-${interaction.timestamp}`}
                  className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 animate-bounce-in"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {interaction.type === 'wave' ? '👋' : 
                       interaction.type === 'call-request' ? '📞' : '🎮'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {interaction.senderName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {interaction.type === 'wave' ? 'waved at you!' :
                         interaction.type === 'call-request' ? 'wants to call' :
                         'invited you to Pong!'}
                      </p>
                    </div>
                    <button
                      onClick={() => clearInteraction(interaction.senderId)}
                      className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Chat Messages Bubbles */}
          {chatMessages.slice(-3).map((msg, idx) => (
            <div
              key={`${msg.senderId}-${msg.timestamp}`}
              className="absolute bg-white rounded-lg shadow-md border border-gray-200 px-3 py-2 max-w-[200px] animate-fade-in"
              style={{
                bottom: `${120 + idx * 50}px`,
                left: '50%',
                transform: 'translateX(-50%)',
                opacity: 1 - (idx * 0.3),
              }}
            >
              <p className="text-xs font-semibold text-gray-700">{msg.senderName}</p>
              <p className="text-sm text-gray-900">{msg.message}</p>
            </div>
          ))}
        </main>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { VirtualOffice } from '@/components/game/VirtualOffice'
import { MobileJoystick } from '@/components/game/MobileJoystick'
import { useOfficeSocket } from '@/lib/hooks/use-office-socket'
import { useAuth } from '@/lib/hooks/use-auth'
import { PlayerData, Position, PlayerDirection, getAvatarColor } from '@/lib/game/types'

export default function OfficePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [officeLayout, setOfficeLayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const virtualOfficeRef = useRef<any>(null)
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
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
            
            // Load office layout
            try {
              const layoutRes = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${data.workspace.id}/office/layout`,
                { credentials: 'include' }
              )
              if (layoutRes.ok) {
                const layoutData = await layoutRes.json()
                console.log('Office layout loaded:', layoutData)
                setOfficeLayout(layoutData)
              } else {
                console.log('No office layout found, using default')
              }
            } catch (layoutError) {
              console.error('Failed to load office layout:', layoutError)
            }
          } else {
            // No workspace yet, redirect to onboarding
            console.log('No workspace found, redirecting to onboarding')
            router.push('/onboarding')
          }
        } else {
          // If API call fails, redirect to onboarding
          console.log('API call failed, redirecting to onboarding')
          router.push('/onboarding')
        }
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
        // Redirect to onboarding on error
        router.push('/onboarding')
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
  
  const handlePlayerMove = useCallback((position: Position, direction: PlayerDirection) => {
    sendPosition(position, direction)
  }, [sendPosition])
  
  const handleReady = useCallback(() => {
    console.log('Virtual office ready')
  }, [])
  
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (chatInput.trim()) {
      sendChat(chatInput.trim())
      setChatInput('')
    }
  }
  
  // Mobile joystick handler
  const handleJoystickMove = useCallback((direction: PlayerDirection | null, velocity: { x: number; y: number }) => {
    // Emit a custom event that VirtualOffice can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mobile-joystick', { 
        detail: { direction, velocity } 
      }))
    }
  }, [])
  
  // Show loading while auth or workspace is loading
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Virtual Office...</p>
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
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400">Setting up workspace...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="fixed left-0 right-0 top-16 bottom-0 bg-gray-900 overflow-hidden z-20">
      {/* Compact status bar - only on mobile */}
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50">
          <div className="flex items-center justify-between px-3 py-2">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              isConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
              <span>{isConnected ? `${players.size + 1} online` : 'Connecting...'}</span>
            </div>
            
            {/* Status selector */}
            <select
              className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="available"
              onChange={(e) => sendStatus(e.target.value)}
            >
              <option value="available">🟢 Available</option>
              <option value="busy">🔴 Busy</option>
              <option value="away">🟡 Away</option>
              <option value="dnd">⛔ DND</option>
            </select>
          </div>
        </div>
      )}
      
      {/* Desktop status bar */}
      {!isMobile && (
        <div className="absolute top-2 left-2 z-30 flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md ${
            isConnected ? 'bg-green-500/20 border border-green-500/30' : 'bg-yellow-500/20 border border-yellow-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
            <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
              {isConnected ? `${players.size + 1} online` : 'Connecting...'}
            </span>
          </div>
          
          <select
            className="px-3 py-2 bg-gray-800/90 backdrop-blur-md border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue="available"
            onChange={(e) => sendStatus(e.target.value)}
          >
            <option value="available">🟢 Available</option>
            <option value="busy">🔴 Busy</option>
            <option value="away">🟡 Away</option>
            <option value="dnd">⛔ DND</option>
          </select>
        </div>
      )}
      
      {/* Online Players Panel - Floating */}
      <div className="absolute top-20 right-4 z-30 w-64 bg-gray-900/95 backdrop-blur-md border border-gray-700/50 rounded-lg shadow-xl hidden md:block">
        <div className="p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Online ({players.size + 1})
          </h2>
          
          {/* Current user */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/20 border border-blue-500/30 mb-2">
            <div className="relative flex-shrink-0">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: avatarColor }}
              >
                {user.name?.charAt(0) || user.email.charAt(0)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name || user.email}</p>
              <p className="text-xs text-gray-400">You</p>
            </div>
          </div>
          
          {/* Other users - scrollable */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {playerList.map((player) => (
              <div 
                key={player.id} 
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: player.avatarColor || '#6366f1' }}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <span 
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                      player.status === 'available' ? 'bg-green-500' :
                      player.status === 'busy' ? 'bg-red-500' :
                      player.status === 'away' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}
                  ></span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{player.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{player.status || 'Available'}</p>
                </div>
              </div>
            ))}
            
            {playerList.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No other users online</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Game Container - Full screen */}
      <main className={`absolute ${isMobile ? 'inset-0 top-14' : 'inset-0'}`}>
        <VirtualOffice
          ref={virtualOfficeRef}
          userId={user.id}
          username={user.name || user.email}
          email={user.email}
          workspaceId={workspaceId}
          officeLayout={officeLayout}
          players={playerList}
          onPlayerMove={handlePlayerMove}
          onReady={handleReady}
          className="w-full h-full"
        />
      </main>
      
      {/* Mobile Joystick Controls */}
      {isMobile && (
        <div className="fixed bottom-6 left-6 z-30">
          <MobileJoystick 
            onMove={handleJoystickMove}
            size={100}
          />
        </div>
      )}
      
      {/* Mobile Action Buttons */}
      {isMobile && (
        <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3">
          {/* Chat toggle */}
          <button
            onClick={() => setShowMobileChat(!showMobileChat)}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
              showMobileChat 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-800/80 backdrop-blur-sm text-gray-300 border border-gray-700'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                {Math.min(chatMessages.length, 9)}
              </span>
            )}
          </button>
          
          {/* Quick interactions when nearby */}
          {nearbyPlayerList.length > 0 && (
            <>
              <button
                onClick={() => nearbyPlayerList.forEach(p => sendInteraction(p.id, 'wave'))}
                className="w-14 h-14 rounded-full bg-yellow-500/80 backdrop-blur-sm text-white shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform"
              >
                👋
              </button>
              <button
                onClick={() => nearbyPlayerList.forEach(p => sendInteraction(p.id, 'pong-invite'))}
                className="w-14 h-14 rounded-full bg-purple-500/80 backdrop-blur-sm text-white shadow-lg flex items-center justify-center text-2xl active:scale-95 transition-transform"
              >
                🎮
              </button>
            </>
          )}
        </div>
      )}
      
      {/* Desktop Proximity Panel */}
      {!isMobile && nearbyPlayerList.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/50 p-4 min-w-[320px] max-w-[90vw]">
          <div className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Nearby ({nearbyPlayerList.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {nearbyPlayerList.map(player => (
              <div key={player.id} className="flex items-center gap-2 bg-gray-800/50 rounded-xl p-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: player.avatarColor || '#6366f1' }}
                >
                  {player.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-white">{player.name}</span>
                <div className="flex gap-1 ml-1">
                  <button
                    onClick={() => sendInteraction(player.id, 'wave')}
                    className="p-2 bg-yellow-500/20 hover:bg-yellow-500/40 rounded-lg text-lg transition-colors active:scale-95"
                    title="Wave"
                  >
                    👋
                  </button>
                  <button
                    onClick={() => sendInteraction(player.id, 'call-request')}
                    className="p-2 bg-green-500/20 hover:bg-green-500/40 rounded-lg text-lg transition-colors active:scale-95"
                    title="Request Call"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => sendInteraction(player.id, 'pong-invite')}
                    className="p-2 bg-purple-500/20 hover:bg-purple-500/40 rounded-lg text-lg transition-colors active:scale-95"
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
              className="flex-1 px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
      
      {/* Mobile Chat Panel */}
      {isMobile && showMobileChat && (
        <div className="fixed bottom-24 right-4 left-4 z-30 bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/50 max-h-[50vh] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
            <h3 className="text-sm font-semibold text-white">Chat</h3>
            <button onClick={() => setShowMobileChat(false)} className="text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[100px] max-h-[200px]">
            {chatMessages.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>
            ) : (
              chatMessages.slice(-10).map((msg, idx) => (
                <div key={`${msg.senderId}-${msg.timestamp}-${idx}`} className="flex gap-2">
                  <span className="text-xs font-semibold text-blue-400">{msg.senderName}:</span>
                  <span className="text-sm text-gray-300">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          
          <form onSubmit={handleSendChat} className="p-3 border-t border-gray-700/50 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 text-sm bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl"
            >
              Send
            </button>
          </form>
        </div>
      )}
      
      {/* Incoming Interactions */}
      <div className="fixed top-16 right-4 z-30 flex flex-col gap-2 max-w-[280px]">
        {pendingInteractions.map((interaction) => (
          <div 
            key={`${interaction.senderId}-${interaction.timestamp}`}
            className="bg-gray-900/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-700/50 p-3 animate-bounce-in"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {interaction.type === 'wave' ? '👋' : 
                 interaction.type === 'call-request' ? '📞' : '🎮'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {interaction.senderName}
                </p>
                <p className="text-xs text-gray-400">
                  {interaction.type === 'wave' ? 'waved at you!' :
                   interaction.type === 'call-request' ? 'wants to call' :
                   'invited you to Pong!'}
                </p>
              </div>
              <button
                onClick={() => clearInteraction(interaction.senderId)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Desktop Chat Bubbles */}
      {!isMobile && chatMessages.slice(-3).map((msg, idx) => (
        <div
          key={`${msg.senderId}-${msg.timestamp}-bubble`}
          className="fixed bg-gray-900/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-700/50 px-4 py-2 max-w-[220px] animate-fade-in z-20"
          style={{
            bottom: `${140 + idx * 60}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 1 - (idx * 0.25),
          }}
        >
          <p className="text-xs font-semibold text-blue-400">{msg.senderName}</p>
          <p className="text-sm text-white">{msg.message}</p>
        </div>
      ))}
    </div>
  )
}

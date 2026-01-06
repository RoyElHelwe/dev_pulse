'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { PlayerData, Position, PlayerDirection } from '@/lib/game/types'

interface UseOfficeSocketOptions {
  workspaceId: string
  userId: string
  userName: string
  userEmail?: string
  avatarColor?: string
  enabled?: boolean
}

interface ProximityEvent {
  playerId: string
  nearbyPlayers: string[]
  type: 'enter' | 'exit'
}

interface ChatMessage {
  senderId: string
  senderName: string
  message: string
  position: Position
  timestamp: string
}

interface InteractionEvent {
  senderId: string
  senderName: string
  type: 'wave' | 'call-request' | 'pong-invite'
  timestamp: string
}

interface OfficeSocketHook {
  isConnected: boolean
  players: Map<string, PlayerData>
  nearbyPlayers: Set<string>
  chatMessages: ChatMessage[]
  pendingInteractions: InteractionEvent[]
  sendPosition: (position: Position, direction: PlayerDirection) => void
  sendStatus: (status: string) => void
  sendChat: (message: string, targetUserId?: string) => void
  sendInteraction: (targetUserId: string, type: 'wave' | 'call-request' | 'pong-invite') => void
  clearInteraction: (senderId: string) => void
  connect: () => void
  disconnect: () => void
}

export function useOfficeSocket({
  workspaceId,
  userId,
  userName,
  userEmail,
  avatarColor,
  enabled = true,
}: UseOfficeSocketOptions): OfficeSocketHook {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map())
  const [nearbyPlayers, setNearbyPlayers] = useState<Set<string>>(new Set())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [pendingInteractions, setPendingInteractions] = useState<InteractionEvent[]>([])
  
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return
    
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    
    socketRef.current = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: {
        workspaceId,
        userId,
        room: `office:${workspaceId}`,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    
    const socket = socketRef.current
    
    socket.on('connect', () => {
      console.log('Office socket connected')
      setIsConnected(true)
      
      // Join the office room with full player info
      socket.emit('office:join', { 
        workspaceId, 
        userId,
        name: userName,
        email: userEmail,
        avatarColor,
      })
    })
    
    socket.on('disconnect', (reason) => {
      console.log('Office socket disconnected:', reason)
      setIsConnected(false)
    })
    
    socket.on('connect_error', (error) => {
      console.error('Office socket connection error:', error)
      setIsConnected(false)
    })
    
    // Listen for player updates
    socket.on('office:players', (playerList: PlayerData[]) => {
      console.log('[useOfficeSocket] Received office:players:', playerList)
      const newPlayers = new Map<string, PlayerData>()
      playerList.forEach(player => {
        if (player.id !== userId) {
          newPlayers.set(player.id, player)
        }
      })
      setPlayers(newPlayers)
    })
    
    socket.on('office:player-joined', (player: PlayerData) => {
      console.log('[useOfficeSocket] Player joined:', player)
      if (player.id !== userId) {
        setPlayers(prev => new Map(prev).set(player.id, player))
      }
    })
    
    socket.on('office:player-left', (playerId: string) => {
      console.log('[useOfficeSocket] Player left:', playerId)
      setPlayers(prev => {
        const next = new Map(prev)
        next.delete(playerId)
        return next
      })
    })
    
    socket.on('office:player-moved', (data: { playerId: string; position: Position; direction: PlayerDirection }) => {
      if (data.playerId !== userId) {
        setPlayers(prev => {
          const player = prev.get(data.playerId)
          if (player) {
            const updated = new Map(prev).set(data.playerId, {
              ...player,
              position: data.position,
              direction: data.direction,
            })
            return updated
          }
          return prev
        })
      }
    })
    
    socket.on('office:player-status', (data: { playerId: string; status: string }) => {
      if (data.playerId !== userId) {
        setPlayers(prev => {
          const player = prev.get(data.playerId)
          if (player) {
            return new Map(prev).set(data.playerId, {
              ...player,
              status: data.status as PlayerData['status'],
            })
          }
          return prev
        })
      }
    })
    
    // Proximity events
    socket.on('office:proximity', (data: ProximityEvent) => {
      setNearbyPlayers(prev => {
        const next = new Set(prev)
        if (data.type === 'enter') {
          data.nearbyPlayers.forEach(id => next.add(id))
        } else {
          data.nearbyPlayers.forEach(id => next.delete(id))
        }
        return next
      })
    })
    
    // Chat messages
    socket.on('office:chat-message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-49), message]) // Keep last 50 messages
    })
    
    // Interaction events
    socket.on('office:interaction-received', (interaction: InteractionEvent) => {
      setPendingInteractions(prev => [...prev, interaction])
      
      // Auto-clear after 10 seconds
      setTimeout(() => {
        setPendingInteractions(prev => prev.filter(i => i.senderId !== interaction.senderId || i.timestamp !== interaction.timestamp))
      }, 10000)
    })
  }, [workspaceId, userId, userName, userEmail, avatarColor])
  
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('office:leave', { workspaceId, userId })
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setPlayers(new Map())
      setNearbyPlayers(new Set())
      setChatMessages([])
      setPendingInteractions([])
    }
  }, [workspaceId, userId])
  
  const sendPosition = useCallback((position: Position, direction: PlayerDirection) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('office:move', {
        workspaceId,
        userId,
        position,
        direction,
      })
    }
  }, [workspaceId, userId])
  
  const sendStatus = useCallback((status: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('office:status', {
        workspaceId,
        userId,
        status,
      })
    }
  }, [workspaceId, userId])
  
  const sendChat = useCallback((message: string, targetUserId?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('office:chat', {
        workspaceId,
        userId,
        message,
        targetUserId,
      })
    }
  }, [workspaceId, userId])
  
  const sendInteraction = useCallback((targetUserId: string, type: 'wave' | 'call-request' | 'pong-invite') => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('office:interaction', {
        workspaceId,
        userId,
        targetUserId,
        type,
      })
    }
  }, [workspaceId, userId])
  
  const clearInteraction = useCallback((senderId: string) => {
    setPendingInteractions(prev => prev.filter(i => i.senderId !== senderId))
  }, [])
  
  // Auto-connect when enabled
  useEffect(() => {
    if (enabled) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])
  
  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, could reduce update frequency or send away status
        sendStatus('away')
      } else {
        // Page is visible again
        sendStatus('available')
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sendStatus])
  
  return {
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
    connect,
    disconnect,
  }
}

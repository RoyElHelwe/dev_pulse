'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { PlayerData, Position, PlayerDirection } from '@/lib/game/types'

interface UseOfficeSocketOptions {
  workspaceId: string
  userId: string
  enabled?: boolean
}

interface OfficeSocketHook {
  isConnected: boolean
  players: Map<string, PlayerData>
  sendPosition: (position: Position, direction: PlayerDirection) => void
  sendStatus: (status: string) => void
  connect: () => void
  disconnect: () => void
}

export function useOfficeSocket({
  workspaceId,
  userId,
  enabled = true,
}: UseOfficeSocketOptions): OfficeSocketHook {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map())
  
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
      
      // Join the office room
      socket.emit('office:join', { workspaceId, userId })
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
      const newPlayers = new Map<string, PlayerData>()
      playerList.forEach(player => {
        if (player.id !== userId) {
          newPlayers.set(player.id, player)
        }
      })
      setPlayers(newPlayers)
    })
    
    socket.on('office:player-joined', (player: PlayerData) => {
      if (player.id !== userId) {
        setPlayers(prev => new Map(prev).set(player.id, player))
      }
    })
    
    socket.on('office:player-left', (playerId: string) => {
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
            return new Map(prev).set(data.playerId, {
              ...player,
              position: data.position,
              direction: data.direction,
            })
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
  }, [workspaceId, userId])
  
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('office:leave', { workspaceId, userId })
      socketRef.current.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setPlayers(new Map())
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
    sendPosition,
    sendStatus,
    connect,
    disconnect,
  }
}

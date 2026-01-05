'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const HEARTBEAT_INTERVAL = 25000 // 25 seconds

interface UseOnlineStatusOptions {
  userId?: string
  workspaceId?: string
  enabled?: boolean
}

interface UseOnlineStatusReturn {
  onlineUsers: Set<string>
  isConnected: boolean
  isUserOnline: (userId: string) => boolean
}

export function useOnlineStatus({
  userId,
  workspaceId,
  enabled = true,
}: UseOnlineStatusOptions): UseOnlineStatusReturn {
  const socketRef = useRef<Socket | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [isConnected, setIsConnected] = useState(false)

  // Connect to WebSocket and set up listeners
  useEffect(() => {
    if (!enabled || !userId || !workspaceId) {
      return
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    socketRef.current = socket

    // Connection handlers
    socket.on('connect', () => {
      console.log('[WebSocket] Connected')
      setIsConnected(true)
      
      // Send user connect event
      socket.emit('user:connect', { userId, workspaceId })
    })

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected')
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error)
      setIsConnected(false)
    })

    // Online status handlers
    socket.on('online:users', (data: { users: string[] }) => {
      console.log('[WebSocket] Received online users:', data.users)
      setOnlineUsers(new Set(data.users))
    })

    socket.on('user:online', (data: { userId: string }) => {
      console.log('[WebSocket] User came online:', data.userId)
      setOnlineUsers((prev) => {
        const newSet = new Set(prev)
        newSet.add(data.userId)
        return newSet
      })
    })

    socket.on('user:offline', (data: { userId: string }) => {
      console.log('[WebSocket] User went offline:', data.userId)
      setOnlineUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(data.userId)
        return newSet
      })
    })

    socket.on('user:status:changed', (data: { userId: string; status: string }) => {
      console.log('[WebSocket] User status changed:', data)
      // Could extend this to track different statuses (away, busy, etc.)
    })

    // Set up heartbeat to keep connection alive
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('user:heartbeat', { userId })
      }
    }, HEARTBEAT_INTERVAL)

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [userId, workspaceId, enabled])

  // Helper function to check if a user is online
  const isUserOnline = useCallback(
    (checkUserId: string): boolean => {
      return onlineUsers.has(checkUserId)
    },
    [onlineUsers]
  )

  return {
    onlineUsers,
    isConnected,
    isUserOnline,
  }
}

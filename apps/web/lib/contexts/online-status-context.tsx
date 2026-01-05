'use client'

import { createContext, useContext, ReactNode, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { io, Socket } from 'socket.io-client'

// Use the API URL for WebSocket connection (same server)
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const HEARTBEAT_INTERVAL = 25000 // 25 seconds (less than server timeout)

interface OnlineStatusContextValue {
  onlineUserIds: string[]  // Changed from Set to array for better React tracking
  isConnected: boolean
  isUserOnline: (userId: string) => boolean
}

const OnlineStatusContext = createContext<OnlineStatusContextValue | undefined>(undefined)

interface OnlineStatusProviderProps {
  children: ReactNode
  userId?: string
  workspaceId?: string
}

export function OnlineStatusProvider({
  children,
  userId,
  workspaceId,
}: OnlineStatusProviderProps) {
  const socketRef = useRef<Socket | null>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])  // Changed to array
  const [isConnected, setIsConnected] = useState(false)
  const connectedRef = useRef(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    // Don't connect if already connected or missing data
    if (!userId || !workspaceId) {
      console.log('[WebSocket] Skipping connection (missing data):', { userId: !!userId, workspaceId: !!workspaceId })
      return
    }

    if (initializedRef.current) {
      console.log('[WebSocket] Already initialized, skipping')
      return
    }
    initializedRef.current = true

    console.log('[WebSocket] Attempting to connect to:', SOCKET_URL)
    console.log('[WebSocket] User:', userId, 'Workspace:', workspaceId)

    // Create socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket
    connectedRef.current = true

    // Connection handlers
    socket.on('connect', () => {
      console.log('[WebSocket] ✅ Connected! Socket ID:', socket.id)
      setIsConnected(true)
      
      // Send user connect event
      console.log('[WebSocket] Emitting user:connect', { userId, workspaceId })
      socket.emit('user:connect', { userId, workspaceId })
    })

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] ❌ Disconnected. Reason:', reason)
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] ❌ Connection error:', error.message)
      setIsConnected(false)
    })

    // Online status handlers
    socket.on('online:users', (data: { users: string[] }) => {
      console.log('[WebSocket] 📋 Received online users:', data.users)
      setOnlineUserIds(data.users)  // Directly set the array
    })

    socket.on('user:online', (data: { userId: string }) => {
      console.log('[WebSocket] 🟢 User came online:', data.userId)
      setOnlineUserIds((prev) => {
        if (prev.includes(data.userId)) return prev  // Already online
        return [...prev, data.userId]  // Add to array
      })
    })

    socket.on('user:offline', (data: { userId: string }) => {
      console.log('[WebSocket] 🔴 User went offline:', data.userId)
      setOnlineUserIds((prev) => prev.filter(id => id !== data.userId))  // Remove from array
    })

    // Set up heartbeat
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        console.log('[WebSocket] 💓 Sending heartbeat')
        socket.emit('user:heartbeat', { userId })
      }
    }, HEARTBEAT_INTERVAL)

    // Cleanup
    return () => {
      console.log('[WebSocket] 🧹 Cleaning up connection')
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      initializedRef.current = false
      connectedRef.current = false
    }
  }, [userId, workspaceId])

  const isUserOnline = useCallback(
    (checkUserId: string): boolean => {
      return onlineUserIds.includes(checkUserId)
    },
    [onlineUserIds]
  )

  // Debug log state changes
  useEffect(() => {
    console.log('[OnlineStatusProvider] State changed:', {
      connected: isConnected,
      users: onlineUserIds,
      count: onlineUserIds.length
    })
  }, [isConnected, onlineUserIds])

  return (
    <OnlineStatusContext.Provider 
      value={{
        onlineUserIds,
        isConnected,
        isUserOnline,
      }}
    >
      {children}
    </OnlineStatusContext.Provider>
  )
}

export function useOnlineStatusContext(): OnlineStatusContextValue {
  const context = useContext(OnlineStatusContext)
  if (!context) {
    throw new Error('useOnlineStatusContext must be used within OnlineStatusProvider')
  }
  return context
}

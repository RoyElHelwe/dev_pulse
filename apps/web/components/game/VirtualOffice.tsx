'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import * as Phaser from 'phaser'
import { GAME_CONFIG } from '@/lib/game/constants'
import { OfficeScene, OfficeSceneConfig } from '@/lib/game/scenes/OfficeScene'
import { PlayerData, Position, PlayerDirection } from '@/lib/game/types'

interface VirtualOfficeProps {
  userId: string
  username: string
  email: string
  workspaceId: string
  players?: PlayerData[]  // Remote players to display
  onPlayerMove?: (position: Position, direction: PlayerDirection) => void
  onReady?: () => void
  className?: string
}

export function VirtualOffice({
  userId,
  username,
  email,
  workspaceId,
  players = [],
  onPlayerMove,
  onReady,
  className = '',
}: VirtualOfficeProps) {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Use refs for callbacks to avoid re-initializing the game
  const onPlayerMoveRef = useRef(onPlayerMove)
  const onReadyRef = useRef(onReady)
  
  // Update refs when callbacks change
  useEffect(() => {
    onPlayerMoveRef.current = onPlayerMove
  }, [onPlayerMove])
  
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])
  
  const initGame = useCallback(() => {
    if (!containerRef.current || gameRef.current) return
    
    try {
      const localPlayer: PlayerData = {
        id: userId,
        name: username,
        email: email,
        position: {
          x: GAME_CONFIG.DEFAULT_OFFICE.SPAWN_X,
          y: GAME_CONFIG.DEFAULT_OFFICE.SPAWN_Y,
        },
        direction: 'down',
        status: 'available',
        workspaceId,
      }
      
      const sceneConfig: OfficeSceneConfig = {
        localPlayer,
        onPlayerMove: (position, direction) => {
          onPlayerMoveRef.current?.(position, direction)
        },
        onReady: () => {
          setIsLoading(false)
          onReadyRef.current?.()
        },
      }
      
      // Create a custom scene class with the config baked in
      class ConfiguredOfficeScene extends OfficeScene {
        constructor() {
          super()
        }
        
        init() {
          super.init(sceneConfig)
        }
      }
      
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: GAME_CONFIG.WIDTH,
        height: GAME_CONFIG.HEIGHT,
        backgroundColor: GAME_CONFIG.COLORS.FLOOR,
        physics: {
          default: 'arcade',
          arcade: {
            debug: false,
            gravity: { x: 0, y: 0 },
          },
        },
        scene: ConfiguredOfficeScene,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: '100%',
          height: '100%',
        },
        render: {
          pixelArt: false,
          antialias: true,
        },
        input: {
          touch: true,
        },
      }
      
      gameRef.current = new Phaser.Game(config)
      
      // Store scene reference when ready - poll for scene availability
      const checkScene = () => {
        const scene = gameRef.current?.scene.getScene('OfficeScene') as OfficeScene
        if (scene && scene.scene.isActive()) {
          sceneRef.current = scene
        } else {
          setTimeout(checkScene, 100)
        }
      }
      setTimeout(checkScene, 200)
      
    } catch (err) {
      console.error('Failed to initialize game:', err)
      setError('Failed to load virtual office. Please refresh the page.')
      setIsLoading(false)
    }
  }, [userId, username, email, workspaceId]) // Removed onPlayerMove and onReady from deps
  
  // Initialize game once on mount
  useEffect(() => {
    // Delay initialization to ensure DOM is ready
    const timer = setTimeout(initGame, 100)
    
    return () => {
      clearTimeout(timer)
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
        sceneRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, workspaceId]) // Only reinit if user or workspace changes
  
  // Store players in ref for initial sync
  const playersRef = useRef(players)
  useEffect(() => {
    playersRef.current = players
  }, [players])
  
  // Sync players whenever they change
  useEffect(() => {
    if (sceneRef.current && players.length > 0) {
      console.log('[VirtualOffice] Syncing players:', players)
      sceneRef.current.syncPlayers(players)
    } else if (!sceneRef.current && players.length > 0) {
      // Scene not ready yet, poll for it
      const checkAndSync = () => {
        if (sceneRef.current) {
          console.log('[VirtualOffice] Scene ready, syncing players:', playersRef.current)
          sceneRef.current.syncPlayers(playersRef.current)
        } else {
          setTimeout(checkAndSync, 200)
        }
      }
      checkAndSync()
    }
  }, [players])
  
  // Public API for parent components
  const addRemotePlayer = useCallback((playerData: PlayerData) => {
    sceneRef.current?.addRemotePlayer(playerData)
  }, [])
  
  const updateRemotePlayer = useCallback((playerId: string, data: Partial<PlayerData>) => {
    sceneRef.current?.updateRemotePlayer(playerId, data)
  }, [])
  
  const removeRemotePlayer = useCallback((playerId: string) => {
    sceneRef.current?.removeRemotePlayer(playerId)
  }, [])
  
  const syncPlayers = useCallback((players: PlayerData[]) => {
    sceneRef.current?.syncPlayers(players)
  }, [])
  
  // Expose methods via ref
  useEffect(() => {
    // Attach methods to window for debugging (optional)
    if (typeof window !== 'undefined') {
      (window as any).__virtualOffice = {
        addRemotePlayer,
        updateRemotePlayer,
        removeRemotePlayer,
        syncPlayers,
      }
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__virtualOffice
      }
    }
  }, [addRemotePlayer, updateRemotePlayer, removeRemotePlayer, syncPlayers])
  
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center p-8">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsLoading(true)
              initGame()
            }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="absolute inset-0">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Virtual Office...</p>
          </div>
        </div>
      )}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  )
}

// Export types and methods for WebSocket integration
export type VirtualOfficeRef = {
  addRemotePlayer: (playerData: PlayerData) => void
  updateRemotePlayer: (playerId: string, data: Partial<PlayerData>) => void
  removeRemotePlayer: (playerId: string) => void
  syncPlayers: (players: PlayerData[]) => void
}

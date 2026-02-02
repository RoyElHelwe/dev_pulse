'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Socket } from 'socket.io-client'
import SimplePeer, { Instance as SimplePeerInstance } from 'simple-peer'
import { Position } from '@/lib/game/types'
import type { CallQualityStats, CallStatus, PeerConnection } from './types/voice-call.types'
import {
  calculateCallQualityScore,
  calculateJitterTrend,
  calculatePacketLossRate,
} from './types/voice-call.types'

// ============================================
// TYPES
// ============================================

interface CallInvitation {
  callerId: string
  callerName: string
  callType: 'voice' | 'proximity'
  timestamp: string
}


interface UseVoiceCallOptions {
  socket: Socket | null
  userId: string
  userName: string
  workspaceId: string
  enabled?: boolean
  maxAudioDistance?: number
  minAudioDistance?: number
  spatialAudioEnabled?: boolean
  onCallQualityUpdate?: (stats: CallQualityStats) => void
}

interface UseVoiceCallReturn {
  callStatus: CallStatus
  isMuted: boolean
  isDeafened: boolean
  activeCall: { peerId: string; peerName: string } | null
  incomingCall: CallInvitation | null
  connectedPeers: Map<string, PeerConnection>
  proximityVoiceEnabled: boolean
  callQuality: CallQualityStats | null
  startCall: (targetUserId: string, targetUserName: string) => Promise<void>
  acceptCall: () => Promise<void>
  declineCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleDeafen: () => void
  toggleProximityVoice: () => void
  updatePeerPosition: (peerId: string, position: Position) => void
  updateLocalPosition: (position: Position) => void
}

// ============================================
// ICE SERVERS (Free STUN + Optional TURN)
// ============================================

const ICE_SERVERS: RTCIceServer[] = [
  // Primary STUN servers (Google - most reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Backup STUN servers (in case Google is blocked/unavailable)
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voip.blackberry.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.nextcloud.com:443' },
  // Free TURN servers (for symmetric NAT traversal - limited bandwidth)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
]

// Add custom TURN server if configured (recommended for production)
if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
  // Insert custom TURN at the beginning for priority
  ICE_SERVERS.unshift({
    urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'devpulse',
    credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'devpulse123',
  })
  console.log('[VoiceCall] 🔄 Custom TURN server configured:', process.env.NEXT_PUBLIC_TURN_SERVER_URL)
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useVoiceCall({
  socket,
  userId,
  userName,
  workspaceId,
  enabled = true,
  maxAudioDistance = 300,
  minAudioDistance = 50,
  spatialAudioEnabled = true,
  onCallQualityUpdate,
}: UseVoiceCallOptions): UseVoiceCallReturn {
  // Debug: Log on mount
  useEffect(() => {
    console.log('[VoiceCall] 🎯 Hook mounted for user:', userId, 'socket ready:', !!socket, 'enabled:', enabled)
  }, [])
  
  // State
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [activeCall, setActiveCall] = useState<{ peerId: string; peerName: string } | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallInvitation | null>(null)
  const [connectedPeers, setConnectedPeers] = useState<Map<string, PeerConnection>>(new Map())
  const [proximityVoiceEnabled, setProximityVoiceEnabled] = useState(false)
  const [callQuality, setCallQuality] = useState<CallQualityStats | null>(null)

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerConnection>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const localPositionRef = useRef<Position>({ x: 0, y: 0 })
  const callStatusRef = useRef<CallStatus>('idle')
  const activeCallRef = useRef<{ id: string; peerId: string; peerName: string } | null>(null)
  const pendingSignalsRef = useRef<Map<string, SimplePeer.SignalData[]>>(new Map()) // Buffer for early signals
  const signalTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map()) // Track signal buffer timeouts
  const qualitySamplesRef = useRef<Map<string, number[]>>(new Map()) // Track jitter samples per peer
  
  // Keep refs in sync with state
  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  useEffect(() => {
    activeCallRef.current = activeCall ? { id: `${userId}-${activeCall.peerId}`, ...activeCall } : null
  }, [activeCall, userId])

  // ============================================
  // AUDIO CONTEXT FOR SPATIAL AUDIO
  // ============================================

  const getAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    // Resume if suspended (Chrome requires user gesture)
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume()
        console.log('[VoiceCall] 🔊 AudioContext resumed')
      } catch (e) {
        console.warn('[VoiceCall] Failed to resume AudioContext:', e)
      }
    }
    
    return audioContextRef.current
  }, [])

  // ============================================
  // SPATIAL AUDIO CALCULATIONS
  // ============================================

  const calculateSpatialAudio = useCallback((
    localPos: Position,
    peerPos: Position
  ): { volume: number; pan: number } => {
    const dx = peerPos.x - localPos.x
    const dy = peerPos.y - localPos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    let volume = 1
    if (distance > minAudioDistance) {
      volume = Math.max(0, 1 - (distance - minAudioDistance) / (maxAudioDistance - minAudioDistance))
    }

    const pan = Math.max(-1, Math.min(1, dx / maxAudioDistance))

    return { volume, pan }
  }, [maxAudioDistance, minAudioDistance])

  // ============================================
  // APPLY SPATIAL AUDIO
  // ============================================

  const applySpatialAudio = useCallback(async (peerConnection: PeerConnection) => {
    if (!spatialAudioEnabled || !peerConnection.position || !peerConnection.audioElement) {
      return
    }

    const { volume, pan } = calculateSpatialAudio(localPositionRef.current, peerConnection.position)
    const audioContext = await getAudioContext()

    if (peerConnection.gainNode) {
      peerConnection.gainNode.gain.setValueAtTime(
        isDeafened ? 0 : volume,
        audioContext.currentTime
      )
    }

    if (peerConnection.pannerNode) {
      peerConnection.pannerNode.pan.setValueAtTime(pan, audioContext.currentTime)
    }
  }, [spatialAudioEnabled, calculateSpatialAudio, isDeafened, getAudioContext])

  // ============================================
  // WEBRTC STATS MONITORING
  // ============================================

  const startStatsMonitoring = useCallback((peerId: string, peer: SimplePeerInstance) => {
    // Monitor WebRTC stats every 5 seconds for call quality
    const statsInterval = setInterval(async () => {
      try {
        // Access the underlying RTCPeerConnection
        const pc = (peer as any)._pc as RTCPeerConnection | undefined
        if (!pc || pc.connectionState !== 'connected') return

        const stats = await pc.getStats()
        let packetsLost = 0
        let packetsReceived = 0
        let jitter = 0
        let roundTripTime = 0
        let bytesReceived = 0

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost = report.packetsLost || 0
            packetsReceived = report.packetsReceived || 0
            jitter = report.jitter || 0
            bytesReceived = report.bytesReceived || 0
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            roundTripTime = report.currentRoundTripTime || 0
          }
        })

        const jitterMs = Math.round(jitter * 1000)
        const rttMs = Math.round(roundTripTime * 1000)

        const packetLossRate = calculatePacketLossRate(packetsLost, packetsReceived)
        const { trend: jitterTrend, samples } = calculateJitterTrend(
          qualitySamplesRef.current.get(peerId) || [],
          jitterMs,
        )
        qualitySamplesRef.current.set(peerId, samples)

        const qualityScore = calculateCallQualityScore({
          packetLossRate,
          jitter: jitterMs,
          roundTripTime: rttMs,
        })

        const qualityStats: CallQualityStats = {
          peerId,
          packetsLost,
          packetsReceived,
          jitter: jitterMs,
          roundTripTime: rttMs,
          bytesReceived,
          timestamp: Date.now(),
          packetLossRate,
          qualityScore,
          jitterTrend,
          previousSamples: samples,
        }

        setCallQuality(qualityStats)
        onCallQualityUpdate?.(qualityStats)

        // Log warning if call quality is poor (thresholds are in ms)
        if (packetLossRate > 5 || jitterMs > 50 || rttMs > 300) {
          console.warn('[VoiceCall] ⚠️ Poor call quality detected:', {
            packetLossRate: `${packetLossRate.toFixed(1)}%`,
            jitter: `${jitterMs}ms`,
            rtt: `${rttMs}ms`,
            qualityScore,
          })
        }
      } catch (e) {
        // Stats collection failed, peer might be disconnected
      }
    }, 5000)

    return statsInterval
  }, [onCallQualityUpdate])

  // ============================================
  // GET LOCAL AUDIO STREAM
  // ============================================

  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) {
      console.log('[VoiceCall] 🎤 Using cached audio stream')
      return localStreamRef.current
    }

    try {
      console.log('[VoiceCall] 🎤 Requesting new audio stream...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      console.log('[VoiceCall] ✅ Audio stream obtained, tracks:', stream.getAudioTracks().length)
      localStreamRef.current = stream
      return stream
    } catch (error) {
      console.error('[VoiceCall] ❌ Failed to get microphone access:', error)
      throw error
    }
  }, [])

  // ============================================
  // CLEANUP FUNCTIONS
  // ============================================

  const cleanupPeer = useCallback((peerId: string) => {
    const peerConnection = peersRef.current.get(peerId)
    if (peerConnection) {
      // 1) Clear timers first
      if (peerConnection.statsInterval) clearInterval(peerConnection.statsInterval)

      // Clear any buffered signals + timeouts for this peer
      pendingSignalsRef.current.delete(peerId)
      const signalTimeout = signalTimeoutsRef.current.get(peerId)
      if (signalTimeout) {
        clearTimeout(signalTimeout)
        signalTimeoutsRef.current.delete(peerId)
      }

      // 2) Stop media tracks
      try {
        peerConnection.stream?.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      } catch {
        // ignore
      }

      // 3) Disconnect Web Audio nodes (source → processing → destination)
      try {
        peerConnection.sourceNode?.disconnect()
      } catch {
        // ignore
      }
      try {
        peerConnection.gainNode?.disconnect()
        peerConnection.pannerNode?.disconnect()
      } catch {
        // ignore
      }

      // 4) Remove DOM elements
      if (peerConnection.audioElement) {
        try {
          peerConnection.audioElement.pause()
          peerConnection.audioElement.srcObject = null
          peerConnection.audioElement.remove()
        } catch (e) {
          console.warn('[VoiceCall] Audio element cleanup error:', e)
        }
      }

      // 5) Destroy peer connection last
      try {
        peerConnection.peer.removeAllListeners()
        peerConnection.peer.destroy()
      } catch (e) {
        console.warn('[VoiceCall] Peer cleanup error:', e)
      }

      peersRef.current.delete(peerId)
    }
    
    // Safety: Also remove any orphaned audio elements
    const orphanedElement = document.getElementById(`voice-peer-${peerId}`)
    if (orphanedElement) {
      console.log('[VoiceCall] 🧹 Removing orphaned audio element for', peerId)
      orphanedElement.remove()
    }
    
    // Clear call quality state only if it belongs to this peer
    setCallQuality((prev: CallQualityStats | null) => (prev?.peerId === peerId ? null : prev))
    
    // Batch state update
    setConnectedPeers(new Map(peersRef.current))
  }, [])

  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach((peerConnection: PeerConnection, peerId: string) => {
      void peerConnection
      cleanupPeer(peerId)
    })
    peersRef.current.clear()
    setConnectedPeers(new Map())
  }, [cleanupPeer])

  const cleanupLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      localStreamRef.current = null
    }
  }, [])

  // ============================================
  // CREATE PEER CONNECTION
  // ============================================

  const createPeerConnection = useCallback((
    targetUserId: string,
    targetUserName: string,
    initiator: boolean,
    stream: MediaStream
  ): SimplePeerInstance => {
    console.log(`[VoiceCall] 🔌 Creating peer connection to ${targetUserName} (initiator: ${initiator})`)

    const peer = new SimplePeer({
      initiator,
      stream,
      trickle: true,
      config: {
        iceServers: ICE_SERVERS,
      },
    })

    const peerConnection: PeerConnection = {
      peerId: targetUserId,
      peerName: targetUserName,
      peer,
      reconnectionAttempts: 0,
    }
    peersRef.current.set(targetUserId, peerConnection)
    setConnectedPeers(new Map(peersRef.current))

    peer.on('signal', (data: SimplePeer.SignalData) => {
      console.log('[VoiceCall] 📡 Sending signal:', data.type || 'candidate')
      socket?.emit('voice:signal', {
        workspaceId,
        targetUserId,
        signalData: data,
        fromUserId: userId,
        fromUserName: userName,
      })
    })

    peer.on('stream', async (remoteStream: MediaStream) => {
      console.log('[VoiceCall] 🔊 Received remote stream')
      
      const audioElement = document.createElement('audio')
      audioElement.srcObject = remoteStream
      audioElement.autoplay = true
      audioElement.id = `voice-peer-${targetUserId}` // Add ID for easier cleanup
      ;(audioElement as any).playsInline = true
      document.body.appendChild(audioElement)

      const audioContext = await getAudioContext()
      const source = audioContext.createMediaStreamSource(remoteStream)
      const gainNode = audioContext.createGain()
      const pannerNode = audioContext.createStereoPanner()

      source.connect(gainNode)
      gainNode.connect(pannerNode)
      pannerNode.connect(audioContext.destination)

      const storedPeerConnection = peersRef.current.get(targetUserId)
      if (storedPeerConnection) {
        storedPeerConnection.stream = remoteStream
        storedPeerConnection.audioElement = audioElement
        storedPeerConnection.sourceNode = source
        storedPeerConnection.gainNode = gainNode
        storedPeerConnection.pannerNode = pannerNode
        applySpatialAudio(storedPeerConnection)
        setConnectedPeers(new Map(peersRef.current))
      }
    })

    peer.on('connect', () => {
      console.log('[VoiceCall] ✅ Peer connected')
      setCallStatus('connected')
      
      // Start monitoring call quality stats
      const storedPeerConnection = peersRef.current.get(targetUserId)
      if (storedPeerConnection) {
        storedPeerConnection.statsInterval = startStatsMonitoring(targetUserId, peer)
      }
    })

    peer.on('close', () => {
      console.log('[VoiceCall] 🔌 Peer disconnected')
      cleanupPeer(targetUserId)
    })

    peer.on('error', (err: Error) => {
      console.error('[VoiceCall] ❌ Peer error:', err)
      setCallStatus('failed')
    })

    // Process any buffered signals that arrived before peer was created
    const bufferedSignals = pendingSignalsRef.current.get(targetUserId)
    if (bufferedSignals && bufferedSignals.length > 0) {
      console.log(`[VoiceCall] 📡 Processing ${bufferedSignals.length} buffered signals`)
      bufferedSignals.forEach((signal: SimplePeer.SignalData) => {
        try {
          peer.signal(signal)
        } catch (e) {
          console.warn('[VoiceCall] Failed to process buffered signal:', e)
        }
      })
      pendingSignalsRef.current.delete(targetUserId)
      
      // Clear the timeout since we processed the signals
      const timeout = signalTimeoutsRef.current.get(targetUserId)
      if (timeout) {
        clearTimeout(timeout)
        signalTimeoutsRef.current.delete(targetUserId)
      }
    }

    return peer
  }, [socket, workspaceId, userId, userName, getAudioContext, applySpatialAudio, startStatsMonitoring])

  // ============================================
  // CALL ACTIONS
  // ============================================

  const startCall = useCallback(async (targetUserId: string, targetUserName: string) => {
    console.log('[VoiceCall] 📞 startCall:', { targetUserId, targetUserName, callStatus, socketReady: !!socket })
    
    if (!socket) {
      console.error('[VoiceCall] ❌ Socket not available')
      return
    }
    
    if (callStatus !== 'idle') {
      console.error('[VoiceCall] ❌ Already in call. Status:', callStatus)
      return
    }

    try {
      console.log('[VoiceCall] ✅ Starting call...')
      setCallStatus('calling')
      setActiveCall({ peerId: targetUserId, peerName: targetUserName })

      // Get microphone access first
      const stream = await getLocalStream()
      console.log('[VoiceCall] ✅ Got microphone')

      // Send invite - DON'T create peer yet, wait for acceptance
      socket.emit('voice:call-invite', {
        workspaceId,
        targetUserId,
        callerId: userId,
        callerName: userName,
        callType: 'voice',
      })
      
      console.log('[VoiceCall] 📤 Invite sent, waiting for acceptance...')
      // Peer will be created when we receive voice:call-accepted

    } catch (error) {
      console.error('[VoiceCall] ❌ Failed to start call:', error)
      setCallStatus('failed')
      setActiveCall(null)
    }
  }, [socket, callStatus, workspaceId, userId, userName, getLocalStream])

  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCall) return

    try {
      setCallStatus('connecting')
      setActiveCall({ peerId: incomingCall.callerId, peerName: incomingCall.callerName })

      const stream = await getLocalStream()

      socket.emit('voice:call-accept', {
        workspaceId,
        callerId: incomingCall.callerId,
        calleeId: userId,
        calleeName: userName,
      })

      createPeerConnection(incomingCall.callerId, incomingCall.callerName, false, stream)
      setIncomingCall(null)

    } catch (error) {
      console.error('[VoiceCall] ❌ Failed to accept call:', error)
      setCallStatus('failed')
      setActiveCall(null)
      setIncomingCall(null)
    }
  }, [socket, incomingCall, workspaceId, userId, userName, getLocalStream, createPeerConnection])

  const declineCall = useCallback(() => {
    if (!socket || !incomingCall) return

    socket.emit('voice:call-decline', {
      workspaceId,
      callerId: incomingCall.callerId,
      calleeId: userId,
    })

    setIncomingCall(null)
    setCallStatus('idle')
  }, [socket, incomingCall, workspaceId, userId])

  const endCall = useCallback(() => {
    if (!socket) return

    peersRef.current.forEach((peerConnection: PeerConnection) => {
      socket.emit('voice:call-end', {
        workspaceId,
        targetUserId: peerConnection.peerId,
        fromUserId: userId,
      })
    })

    cleanupAllPeers()
    cleanupLocalStream()
    setCallStatus('ended')
    setActiveCall(null)

    setTimeout(() => setCallStatus('idle'), 1000)
  }, [socket, workspaceId, userId, cleanupAllPeers, cleanupLocalStream])

  // ============================================
  // AUDIO CONTROLS
  // ============================================

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }, [])

  const toggleDeafen = useCallback(async () => {
    const audioContext = await getAudioContext()
    setIsDeafened((prev: boolean) => {
      const newDeafened = !prev
      peersRef.current.forEach((peerConnection: PeerConnection) => {
        if (peerConnection.gainNode) {
          peerConnection.gainNode.gain.setValueAtTime(
            newDeafened ? 0 : 1,
            audioContext.currentTime
          )
        }
      })
      return newDeafened
    })
  }, [getAudioContext])

  const toggleProximityVoice = useCallback(() => {
    setProximityVoiceEnabled((prev: boolean) => !prev)
  }, [])

  // ============================================
  // SPATIAL AUDIO POSITION UPDATES
  // ============================================

  const updatePeerPosition = useCallback((peerId: string, position: Position) => {
    const peerConnection = peersRef.current.get(peerId)
    if (peerConnection) {
      peerConnection.position = position
      applySpatialAudio(peerConnection)
    }
  }, [applySpatialAudio])

  const updateLocalPosition = useCallback((position: Position) => {
    localPositionRef.current = position
    peersRef.current.forEach((peerConnection: PeerConnection) => {
      applySpatialAudio(peerConnection)
    })
  }, [applySpatialAudio])

  // ============================================
  // SOCKET EVENT LISTENERS
  // ============================================

  useEffect(() => {
    if (!socket || !enabled) {
      console.log('[VoiceCall] ⏳ Socket listeners NOT set up - socket:', !!socket, 'enabled:', enabled)
      return
    }

    console.log('[VoiceCall] ✅ Setting up socket listeners, socket id:', socket.id)

    const handleCallInvitation = (data: CallInvitation) => {
      console.log('[VoiceCall] 📞 Incoming call from', data.callerName, 'current status:', callStatusRef.current)
      if (callStatusRef.current === 'idle') {
        setIncomingCall(data)
        setCallStatus('ringing')
      }
    }

    socket.on('voice:call-invitation', handleCallInvitation)

    socket.on('voice:call-accepted', async (data: { calleeId: string; calleeName: string }) => {
      console.log('[VoiceCall] ✅ Call accepted by', data.calleeName)
      setCallStatus('connecting')
      
      // Ensure we have the stream (retry if needed)
      let stream = localStreamRef.current
      if (!stream) {
        console.log('[VoiceCall] ⏳ Stream not ready, requesting...')
        try {
          stream = await getLocalStream()
        } catch (error) {
          console.error('[VoiceCall] ❌ Failed to get stream on acceptance:', error)
          setCallStatus('failed')
          setActiveCall(null)
          cleanupLocalStream()
          
          // Notify the other user
          socket.emit('voice:call-error', {
            workspaceId,
            targetUserId: data.calleeId,
            message: 'Microphone access failed',
          })
          return
        }
      }
      
      console.log('[VoiceCall] 🔌 Creating peer connection as initiator')
      createPeerConnection(data.calleeId, data.calleeName, true, stream)
    })

    socket.on('voice:call-declined', () => {
      console.log('[VoiceCall] ❌ Call declined')
      cleanupAllPeers()
      cleanupLocalStream()
      setCallStatus('declined')
      setActiveCall(null)
      setTimeout(() => setCallStatus('idle'), 2000)
    })

    socket.on('voice:call-ended', (data: { fromUserId: string }) => {
      console.log('[VoiceCall] Call ended by peer')
      cleanupPeer(data.fromUserId)
      if (peersRef.current.size === 0) {
        cleanupLocalStream()
        setCallStatus('ended')
        setActiveCall(null)
        setTimeout(() => setCallStatus('idle'), 1000)
      }
    })

    socket.on('voice:signal', (data: {
      fromUserId: string
      signalData: SimplePeer.SignalData
    }) => {
      console.log('[VoiceCall] 📡 Received signal from', data.fromUserId)
      const peerConnection = peersRef.current.get(data.fromUserId)
      if (peerConnection) {
        try {
          peerConnection.peer.signal(data.signalData)
        } catch (e) {
          console.warn('[VoiceCall] Failed to signal peer:', e)
        }
      } else {
        // Buffer signals that arrive before peer is created (race condition fix)
        console.log('[VoiceCall] 📦 Buffering signal for', data.fromUserId)
        const existing = pendingSignalsRef.current.get(data.fromUserId) || []
        if (existing.length >= 50) {
          existing.shift() // keep last 50 signals
        }
        existing.push(data.signalData)
        pendingSignalsRef.current.set(data.fromUserId, existing)
        
        // Clear any existing timeout for this user
        const existingTimeout = signalTimeoutsRef.current.get(data.fromUserId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }
        
        // Auto-clear buffer after 30 seconds to prevent memory leak
        const timeout = setTimeout(() => {
          pendingSignalsRef.current.delete(data.fromUserId)
          signalTimeoutsRef.current.delete(data.fromUserId)
        }, 30000)
        signalTimeoutsRef.current.set(data.fromUserId, timeout)
      }
    })

    socket.on('voice:call-error', (data: { message: string }) => {
      console.error('[VoiceCall] ❌ Call error:', data.message)
      cleanupAllPeers()
      cleanupLocalStream()
      setCallStatus('failed')
      setActiveCall(null)
      setTimeout(() => setCallStatus('idle'), 2000)
    })

    // Handle socket reconnection - attempt to restore active call
    const handleReconnect = () => {
      console.log('[VoiceCall] 🔄 Socket reconnected')
      const status = callStatusRef.current
      const shouldAttemptRejoin =
        status !== 'idle' &&
        status !== 'ended' &&
        status !== 'failed' &&
        status !== 'declined'

      if (activeCallRef.current && shouldAttemptRejoin) {
        console.log('[VoiceCall] 🔄 Notifying server of active call after reconnect')
        // Re-join the call room
        socket.emit('voice:rejoin-call', {
          workspaceId,
          callId: activeCallRef.current.id,
          userId,
        })
      }
    }

    const handleDisconnect = (reason: string) => {
      console.warn('[VoiceCall] ⚠️ Socket disconnected:', reason)
      // Don't immediately cleanup - wait for potential reconnect
      if (reason === 'io server disconnect') {
        // Server intentionally disconnected, cleanup
        cleanupAllPeers()
        cleanupLocalStream()
        setCallStatus('failed')
        setActiveCall(null)
      }
    }

    // Handle rejoin success - need to re-establish peer connections
    const handleRejoinSuccess = async (data: { callId: string; participants: string[] }) => {
      console.log('[VoiceCall] ✅ Rejoin successful, participants:', data.participants)
      // Re-establish peer connections with existing participants
      const stream = localStreamRef.current
      if (stream && data.participants.length > 0) {
        for (const participantId of data.participants) {
          // Check if we already have a connection
          if (!peersRef.current.has(participantId)) {
            console.log('[VoiceCall] 🔌 Re-establishing connection with', participantId)
            createPeerConnection(participantId, 'Participant', true, stream)
          }
        }
      }
    }

    // Handle rejoin failure - call is no longer active
    const handleRejoinFailed = (data: { callId: string; reason: string }) => {
      console.log('[VoiceCall] ❌ Rejoin failed:', data.reason)
      cleanupAllPeers()
      cleanupLocalStream()
      setCallStatus('ended')
      setActiveCall(null)
      setTimeout(() => setCallStatus('idle'), 1000)
    }

    // Handle peer reconnection notification
    const handlePeerReconnected = (data: { userId: string; callId: string }) => {
      console.log('[VoiceCall] 👋 Peer reconnected:', data.userId)
      // The reconnecting peer will initiate the new connection
    }

    socket.on('connect', handleReconnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('voice:rejoin-success', handleRejoinSuccess)
    socket.on('voice:rejoin-failed', handleRejoinFailed)
    socket.on('voice:peer-reconnected', handlePeerReconnected)

    return () => {
      console.log('[VoiceCall] 🧹 Cleaning up socket listeners')
      socket.off('voice:call-invitation', handleCallInvitation)
      socket.off('voice:call-accepted')
      socket.off('voice:call-declined')
      socket.off('voice:call-ended')
      socket.off('voice:signal')
      socket.off('voice:call-error')
      socket.off('connect', handleReconnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('voice:rejoin-success', handleRejoinSuccess)
      socket.off('voice:rejoin-failed', handleRejoinFailed)
      socket.off('voice:peer-reconnected', handlePeerReconnected)
    }
  }, [
    socket,
    enabled,
    cleanupAllPeers,
    cleanupLocalStream,
    cleanupPeer,
    createPeerConnection,
    getLocalStream,
    workspaceId,
    userId,
  ])

  useEffect(() => {
    return () => {
      // Cleanup all resources on unmount
      cleanupAllPeers()
      cleanupLocalStream()
      
      // Clear signal buffer and timeouts
      pendingSignalsRef.current.clear()
      signalTimeoutsRef.current.forEach((timeout: ReturnType<typeof setTimeout>) => clearTimeout(timeout))
      signalTimeoutsRef.current.clear()
      
      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
      
      // Remove any orphaned audio elements
      document.querySelectorAll('[id^="voice-peer-"]').forEach(el => el.remove())
    }
  }, [cleanupAllPeers, cleanupLocalStream])

  return {
    callStatus,
    isMuted,
    isDeafened,
    activeCall,
    incomingCall,
    connectedPeers,
    proximityVoiceEnabled,
    callQuality,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleDeafen,
    toggleProximityVoice,
    updatePeerPosition,
    updateLocalPosition,
  }
}

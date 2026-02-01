'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { Socket } from 'socket.io-client'
import SimplePeer, { Instance as SimplePeerInstance } from 'simple-peer'
import { Position } from '@/lib/game/types'

// ============================================
// TYPES
// ============================================

export type CallStatus = 
  | 'idle' 
  | 'calling' 
  | 'ringing' 
  | 'connecting' 
  | 'connected' 
  | 'ended' 
  | 'failed'
  | 'declined'

interface PeerConnection {
  peerId: string
  peerName: string
  peer: SimplePeerInstance
  stream?: MediaStream
  position?: Position
  audioElement?: HTMLAudioElement
  gainNode?: GainNode
  pannerNode?: StereoPannerNode
}

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
}

interface UseVoiceCallReturn {
  callStatus: CallStatus
  isMuted: boolean
  isDeafened: boolean
  activeCall: { peerId: string; peerName: string } | null
  incomingCall: CallInvitation | null
  connectedPeers: Map<string, PeerConnection>
  proximityVoiceEnabled: boolean
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
  // Free STUN servers (for simple NAT traversal)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voip.blackberry.com:3478' },
]

// Add TURN server if configured (for symmetric NAT/firewall traversal)
if (process.env.NEXT_PUBLIC_TURN_SERVER_URL) {
  ICE_SERVERS.push({
    urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'devpulse',
    credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'devpulse123',
  })
  console.log('[VoiceCall] 🔄 TURN server configured:', process.env.NEXT_PUBLIC_TURN_SERVER_URL)
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

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerConnection>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const localPositionRef = useRef<Position>({ x: 0, y: 0 })
  const callStatusRef = useRef<CallStatus>('idle')
  
  // Keep ref in sync with state
  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  // ============================================
  // AUDIO CONTEXT FOR SPATIAL AUDIO
  // ============================================

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
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

  const applySpatialAudio = useCallback((peerConnection: PeerConnection) => {
    if (!spatialAudioEnabled || !peerConnection.position || !peerConnection.audioElement) {
      return
    }

    const { volume, pan } = calculateSpatialAudio(localPositionRef.current, peerConnection.position)

    if (peerConnection.gainNode) {
      peerConnection.gainNode.gain.setValueAtTime(
        isDeafened ? 0 : volume,
        getAudioContext().currentTime
      )
    }

    if (peerConnection.pannerNode) {
      peerConnection.pannerNode.pan.setValueAtTime(pan, getAudioContext().currentTime)
    }
  }, [spatialAudioEnabled, calculateSpatialAudio, isDeafened, getAudioContext])

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
      peerConnection.peer.destroy()
      
      // Properly cleanup audio element
      if (peerConnection.audioElement) {
        peerConnection.audioElement.pause()
        peerConnection.audioElement.srcObject = null
        peerConnection.audioElement.remove()
      }
      
      // Disconnect audio nodes
      peerConnection.gainNode?.disconnect()
      peerConnection.pannerNode?.disconnect()
      
      peersRef.current.delete(peerId)
      setConnectedPeers(new Map(peersRef.current))
    }
    
    // Safety: Also remove any orphaned audio elements
    const orphanedElement = document.getElementById(`voice-peer-${peerId}`)
    if (orphanedElement) {
      console.log('[VoiceCall] 🧹 Removing orphaned audio element for', peerId)
      orphanedElement.remove()
    }
  }, [])

  const cleanupAllPeers = useCallback(() => {
    peersRef.current.forEach((_, peerId) => cleanupPeer(peerId))
    peersRef.current.clear()
    setConnectedPeers(new Map())
  }, [cleanupPeer])

  const cleanupLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
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

    peer.on('stream', (remoteStream: MediaStream) => {
      console.log('[VoiceCall] 🔊 Received remote stream')
      
      const audioElement = document.createElement('audio')
      audioElement.srcObject = remoteStream
      audioElement.autoplay = true
      audioElement.id = `voice-peer-${targetUserId}` // Add ID for easier cleanup
      ;(audioElement as any).playsInline = true
      document.body.appendChild(audioElement)

      const audioContext = getAudioContext()
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
        storedPeerConnection.gainNode = gainNode
        storedPeerConnection.pannerNode = pannerNode
        applySpatialAudio(storedPeerConnection)
        setConnectedPeers(new Map(peersRef.current))
      }
    })

    peer.on('connect', () => {
      console.log('[VoiceCall] ✅ Peer connected')
      setCallStatus('connected')
    })

    peer.on('close', () => {
      console.log('[VoiceCall] 🔌 Peer disconnected')
      peersRef.current.delete(targetUserId)
      setConnectedPeers(new Map(peersRef.current))
    })

    peer.on('error', (err: Error) => {
      console.error('[VoiceCall] ❌ Peer error:', err)
      setCallStatus('failed')
    })

    return peer
  }, [socket, workspaceId, userId, userName, getAudioContext, applySpatialAudio])

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

    peersRef.current.forEach((peerConnection) => {
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

  const toggleDeafen = useCallback(() => {
    setIsDeafened(prev => {
      const newDeafened = !prev
      peersRef.current.forEach((peerConnection) => {
        if (peerConnection.gainNode) {
          peerConnection.gainNode.gain.setValueAtTime(
            newDeafened ? 0 : 1,
            getAudioContext().currentTime
          )
        }
      })
      return newDeafened
    })
  }, [getAudioContext])

  const toggleProximityVoice = useCallback(() => {
    setProximityVoiceEnabled(prev => !prev)
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
    peersRef.current.forEach((peerConnection) => {
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
        peerConnection.peer.signal(data.signalData)
      } else {
        console.warn('[VoiceCall] ⚠️ No peer connection found for', data.fromUserId)
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

    return () => {
      console.log('[VoiceCall] 🧹 Cleaning up socket listeners')
      socket.off('voice:call-invitation', handleCallInvitation)
      socket.off('voice:call-accepted')
      socket.off('voice:call-declined')
      socket.off('voice:call-ended')
      socket.off('voice:signal')
      socket.off('voice:call-error')
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
  ])

  useEffect(() => {
    return () => {
      cleanupAllPeers()
      cleanupLocalStream()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
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

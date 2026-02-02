import type { Instance as SimplePeerInstance } from 'simple-peer'
import type { Position } from '@/lib/game/types'

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed'
  | 'declined'

export interface ReconnectionState {
  isReconnecting: boolean
  countdown: number
  attempt: number
  startedAt: Date
}

export interface CallState {
  status: CallStatus
  callId?: string
  workspaceId?: string
  localUserId?: string
  activePeerId?: string
  startedAt?: Date
  reconnection?: ReconnectionState
}

export interface PeerConnection {
  peerId: string
  peerName: string
  peer: SimplePeerInstance
  stream?: MediaStream
  position?: Position
  audioElement?: HTMLAudioElement
  gainNode?: GainNode
  pannerNode?: StereoPannerNode
  sourceNode?: MediaStreamAudioSourceNode
  statsInterval?: ReturnType<typeof setInterval>
  iceState?: RTCIceConnectionState
  lastConnectedAt?: Date
  reconnectionAttempts: number
}

export type CallQualityScore = 'excellent' | 'good' | 'fair' | 'poor'
export type JitterTrend = 'stable' | 'increasing' | 'decreasing'

export interface CallQualityStats {
  peerId: string
  packetsLost: number
  packetsReceived: number
  jitter: number
  roundTripTime: number
  bytesReceived: number
  timestamp: number

  packetLossRate: number
  qualityScore: CallQualityScore
  jitterTrend: JitterTrend
  previousSamples: number[]
}

export function calculatePacketLossRate(packetsLost: number, packetsReceived: number): number {
  const total = packetsLost + packetsReceived
  if (total <= 0) return 0
  return (packetsLost / total) * 100
}

export function calculateCallQualityScore(metrics: {
  packetLossRate: number
  jitter: number
  roundTripTime: number
}): CallQualityScore {
  const lossRate = metrics.packetLossRate
  const jitter = metrics.jitter
  const rtt = metrics.roundTripTime

  if (lossRate < 1 && jitter < 30 && rtt < 150) return 'excellent'
  if (lossRate < 3 && jitter < 50 && rtt < 250) return 'good'
  if (lossRate < 5 && jitter < 100 && rtt < 400) return 'fair'
  return 'poor'
}

export function calculateJitterTrend(previousSamples: number[] = [], nextJitter: number): {
  trend: JitterTrend
  samples: number[]
} {
  const samples = [...previousSamples, nextJitter].slice(-5)
  if (samples.length < 3) return { trend: 'stable', samples }

  const first = samples[0]
  const last = samples[samples.length - 1]
  const delta = last - first

  if (delta > 5) return { trend: 'increasing', samples }
  if (delta < -5) return { trend: 'decreasing', samples }
  return { trend: 'stable', samples }
}

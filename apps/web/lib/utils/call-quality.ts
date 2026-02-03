import type { CallQualityScore } from '@/lib/hooks/types/voice-call.types'
import {
  calculateCallQualityScore as calculateCallQualityScoreInternal,
  calculatePacketLossRate,
} from '@/lib/hooks/types/voice-call.types'

export interface QualityScoreInput {
  packetsLost: number
  packetsReceived: number
  jitter: number
  roundTripTime: number
}

export function calculateQualityScore(input: QualityScoreInput): {
  packetLossRate: number
  qualityScore: CallQualityScore
} {
  const packetLossRate = calculatePacketLossRate(input.packetsLost, input.packetsReceived)
  const qualityScore = calculateCallQualityScoreInternal({
    packetLossRate,
    jitter: input.jitter,
    roundTripTime: input.roundTripTime,
  })

  return { packetLossRate, qualityScore }
}

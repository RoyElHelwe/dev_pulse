'use client'

import { useEffect, useState } from 'react'
import type { CallStatus, CallQualityStats } from '@/lib/hooks/types/voice-call.types'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

interface VoiceCallUIProps {
  // State from useVoiceCall
  callStatus: CallStatus
  isMuted: boolean
  isDeafened: boolean
  activeCall: { peerId: string; peerName: string } | null
  incomingCall: { callerId: string; callerName: string; callType: string; timestamp: string } | null
  proximityVoiceEnabled: boolean
  connectedPeersCount: number
  callQuality?: CallQualityStats | null
  
  // Actions from useVoiceCall
  acceptCall: () => void
  declineCall: () => void
  endCall: () => void
  toggleMute: () => void
  toggleDeafen: () => void
  toggleProximityVoice: () => void
}

// ============================================
// ICONS (inline SVG for simplicity)
// ============================================

const MicIcon = ({ muted }: { muted?: boolean }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {muted ? (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" className="text-red-500" />
      </>
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    )}
  </svg>
)

const HeadphonesIcon = ({ deafened }: { deafened?: boolean }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
    {deafened && (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" className="text-red-500" />
    )}
  </svg>
)

const PhoneIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)

const PhoneOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.516l2.257-1.13a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
  </svg>
)

const WifiIcon = ({ enabled }: { enabled?: boolean }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={enabled 
      ? "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
      : "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    } />
  </svg>
)

// ============================================
// CONNECTION QUALITY INDICATOR (T013)
// ============================================

const QualityIndicator = ({ quality }: { quality: CallQualityStats | null }) => {
  if (!quality) return null

  const { qualityScore, packetLossRate, jitter, roundTripTime } = quality
  
  // Determine color and icon based on quality score
  const getQualityStyle = () => {
    if (qualityScore === 'excellent') {
      return { color: 'text-green-500', bars: 4, label: 'Excellent' }
    } else if (qualityScore === 'good') {
      return { color: 'text-green-400', bars: 3, label: 'Good' }
    } else if (qualityScore === 'fair') {
      return { color: 'text-yellow-500', bars: 2, label: 'Fair' }
    } else {
      return { color: 'text-red-500', bars: 1, label: 'Poor' }
    }
  }

  const style = getQualityStyle()

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <div className={cn("flex items-center gap-0.5", style.color)}>
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={cn(
              "w-0.5 rounded-full transition-all",
              bar <= style.bars ? "bg-current" : "bg-gray-600"
            )}
            style={{ height: `${bar * 3 + 4}px` }}
          />
        ))}
      </div>
      <span className={style.color} title={`Packet Loss: ${packetLossRate.toFixed(1)}% | Jitter: ${jitter}ms | RTT: ${roundTripTime}ms`}>
        {style.label}
      </span>
    </div>
  )
}

// ============================================
// INCOMING CALL MODAL
// ============================================

function IncomingCallModal({
  callerName,
  callType,
  onAccept,
  onDecline,
}: {
  callerName: string
  callType: string
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 p-6 max-w-sm w-full mx-4 animate-in zoom-in-95">
        {/* Avatar/Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center animate-pulse">
            <PhoneIcon />
          </div>
        </div>
        
        {/* Caller Info */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-white mb-1">{callerName}</h3>
          <p className="text-gray-400 text-sm">
            {callType === 'proximity' ? 'Proximity voice chat' : 'Incoming voice call'}
          </p>
        </div>
        
        {/* Ringing animation */}
        <div className="flex justify-center gap-1 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-green-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onDecline}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors"
          >
            <PhoneOffIcon />
            <span>Decline</span>
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
          >
            <PhoneIcon />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// ACTIVE CALL BAR
// ============================================

function ActiveCallBar({
  peerName,
  callStatus,
  duration,
  isMuted,
  isDeafened,
  callQuality,
  onToggleMute,
  onToggleDeafen,
  onEndCall,
}: {
  peerName: string
  callStatus: CallStatus
  duration: number
  isMuted: boolean
  isDeafened: boolean
  callQuality?: CallQualityStats | null
  onToggleMute: () => void
  onToggleDeafen: () => void
  onEndCall: () => void
}) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="fixed left-1/2 top-[calc(4rem+0.75rem)] -translate-x-1/2 z-50 bg-gray-900/95 backdrop-blur-md rounded-full shadow-lg border border-gray-700 px-4 py-2 flex items-center gap-3 animate-in slide-in-from-top"
    >
      {/* Status indicator */}
      <div className={cn(
        "w-2 h-2 rounded-full",
        callStatus === 'connected' ? "bg-green-400 animate-pulse" :
        callStatus === 'connecting' ? "bg-yellow-400 animate-pulse" :
        "bg-gray-400"
      )} />
      
      {/* Peer name and duration */}
      <div className="flex items-center gap-2">
        <span className="text-white font-medium text-sm">{peerName}</span>
        {callStatus === 'connected' && (
          <>
            <span className="text-gray-400 text-xs">{formatDuration(duration)}</span>
            {/* Quality indicator */}
            <QualityIndicator quality={callQuality || null} />
          </>
        )}
        {callStatus === 'connecting' && (
          <span className="text-yellow-400 text-xs">Connecting...</span>
        )}
        {callStatus === 'calling' && (
          <span className="text-blue-400 text-xs">Calling...</span>
        )}
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={onToggleMute}
          className={cn(
            "p-2 rounded-full transition-colors",
            isMuted ? "bg-red-500/20 text-red-400" : "hover:bg-gray-700 text-gray-300"
          )}
          title={isMuted ? "Unmute" : "Mute"}
        >
          <MicIcon muted={isMuted} />
        </button>
        
        <button
          onClick={onToggleDeafen}
          className={cn(
            "p-2 rounded-full transition-colors",
            isDeafened ? "bg-red-500/20 text-red-400" : "hover:bg-gray-700 text-gray-300"
          )}
          title={isDeafened ? "Undeafen" : "Deafen"}
        >
          <HeadphonesIcon deafened={isDeafened} />
        </button>
        
        {/* Separator */}
        <div className="w-px h-6 bg-gray-600 mx-1" />
        
        {/* End Call Button - More Prominent */}
        <button
          onClick={onEndCall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all hover:scale-105 font-medium text-sm ml-1"
          title="End Call"
        >
          <PhoneOffIcon />
          <span>End Call</span>
        </button>
      </div>
    </div>
  )
}

// ============================================
// PROXIMITY VOICE INDICATOR
// ============================================

function ProximityVoiceIndicator({
  enabled,
  connectedCount,
  onToggle,
}: {
  enabled: boolean
  connectedCount: number
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "fixed bottom-24 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border transition-all",
        enabled
          ? "bg-green-500/20 border-green-500/50 text-green-400"
          : "bg-gray-900/90 border-gray-700 text-gray-400 hover:text-white"
      )}
      title={enabled ? "Disable proximity voice" : "Enable proximity voice"}
    >
      <WifiIcon enabled={enabled} />
      <span className="text-sm font-medium">
        {enabled ? `Voice (${connectedCount})` : "Proximity Voice"}
      </span>
    </button>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function VoiceCallUI({
  callStatus,
  isMuted,
  isDeafened,
  activeCall,
  incomingCall,
  proximityVoiceEnabled,
  connectedPeersCount,
  callQuality,
  acceptCall,
  declineCall,
  endCall,
  toggleMute,
  toggleDeafen,
  toggleProximityVoice,
}: VoiceCallUIProps) {
  const [callDuration, setCallDuration] = useState(0)

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (callStatus === 'connected') {
      setCallDuration(0)
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [callStatus])

  return (
    <>
      {/* Incoming Call Modal */}
      {incomingCall && callStatus === 'ringing' && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callType={incomingCall.callType}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}
      
      {/* Active Call Bar */}
      {activeCall && ['calling', 'connecting', 'connected'].includes(callStatus) && (
        <ActiveCallBar
          peerName={activeCall.peerName}
          callStatus={callStatus}
          duration={callDuration}
          isMuted={isMuted}
          isDeafened={isDeafened}
          callQuality={callQuality}
          onToggleMute={toggleMute}
          onToggleDeafen={toggleDeafen}
          onEndCall={endCall}
        />
      )}
      
      {/* Proximity Voice Indicator */}
      <ProximityVoiceIndicator
        enabled={proximityVoiceEnabled}
        connectedCount={connectedPeersCount}
        onToggle={toggleProximityVoice}
      />
      
      {/* Call Status Toast */}
      {(callStatus === 'ended' || callStatus === 'declined' || callStatus === 'failed') && (
        <div className="fixed left-1/2 top-[calc(4rem+0.75rem)] -translate-x-1/2 z-50 bg-gray-900/95 backdrop-blur-md rounded-full shadow-lg border border-gray-700 px-4 py-2 animate-in fade-in slide-in-from-top">
          <span className={cn(
            "text-sm font-medium",
            callStatus === 'declined' ? "text-yellow-400" :
            callStatus === 'failed' ? "text-red-400" :
            "text-gray-300"
          )}>
            {callStatus === 'ended' && "Call ended"}
            {callStatus === 'declined' && "Call declined"}
            {callStatus === 'failed' && "Call failed"}
          </span>
        </div>
      )}
    </>
  )
}

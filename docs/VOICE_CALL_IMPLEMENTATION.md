# 🎤 Voice Call Implementation Guide

## Overview

This document describes the WebRTC voice call feature implemented for the 2D virtual office with spatial audio support.

## Architecture

```
┌─────────────────┐         WebSocket          ┌────────────────────┐
│   Browser A     │◄────────Signaling──────────│   api-gateway      │
│   (Caller)      │        (Socket.io)         │   NestJS Gateway   │
│                 │                             │                    │
│  useVoiceCall   │                             │  voice:call-invite │
│  simple-peer    │                             │  voice:signal      │
│  Web Audio API  │                             │  voice:call-accept │
└────────┬────────┘                             └────────────────────┘
         │                                                 │
         │                                                 │
         │         WebRTC (Peer-to-Peer)                  │
         │         Audio Stream (SRTP)                    │
         │                                                 │
         │                                                 │
         ▼                                                 ▼
┌─────────────────┐         WebSocket          ┌────────────────────┐
│   Browser B     │◄────────Signaling──────────│   Browser B        │
│   (Callee)      │                            │   receives invite  │
└─────────────────┘                            └────────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STUN/TURN Servers                            │
│  • stun:stun.l.google.com:19302 (free)                         │
│  • stun:stun1.l.google.com:19302 (free)                        │
│  • turn:your-server:3478 (optional coturn)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Files Structure

```
apps/web/
├── lib/hooks/
│   └── use-voice-call.ts      # Main voice call hook
├── components/voice/
│   ├── index.ts               # Exports
│   └── VoiceCallUI.tsx        # UI components

apps/api-gateway/
└── src/websocket/
    └── websocket.gateway.ts   # Added voice signaling events

docker/
└── coturn/
    └── turnserver.conf        # Optional TURN server config
```

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `voice:call-invite` | `{workspaceId, targetUserId, callerId, callerName, callType}` | Initiate a call |
| `voice:call-accept` | `{workspaceId, callerId, calleeId, calleeName}` | Accept incoming call |
| `voice:call-decline` | `{workspaceId, callerId, calleeId}` | Decline incoming call |
| `voice:call-end` | `{workspaceId, targetUserId, fromUserId}` | End active call |
| `voice:signal` | `{workspaceId, targetUserId, signalData, fromUserId, fromUserName}` | WebRTC signaling |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `voice:call-invitation` | `{callerId, callerName, callType, timestamp}` | Incoming call notification |
| `voice:call-accepted` | `{calleeId, calleeName}` | Call was accepted |
| `voice:call-declined` | `{}` | Call was declined |
| `voice:call-ended` | `{fromUserId}` | Call was ended by peer |
| `voice:signal` | `{fromUserId, fromUserName, signalData}` | WebRTC signaling data |

## Spatial Audio

Audio is modified based on the distance between players:

```typescript
// Volume calculation (linear falloff)
const distance = Math.sqrt(dx² + dy²)
let volume = 1
if (distance > minAudioDistance) {  // 50px
  volume = max(0, 1 - (distance - 50) / (300 - 50))
}

// Stereo pan calculation
const pan = clamp(dx / maxAudioDistance, -1, 1)  // -1 left, 1 right
```

### Web Audio API Pipeline

```
MediaStream → MediaStreamSource → GainNode → StereoPannerNode → Destination
                                    (volume)      (stereo pan)
```

## Usage

### Starting a Call

```tsx
const { startCall } = useVoiceCall({ socket, userId, userName, workspaceId })

// When user clicks call button
<button onClick={() => startCall(targetUserId, targetUserName)}>
  📞 Call
</button>
```

### Handling Incoming Calls

```tsx
const { incomingCall, acceptCall, declineCall } = useVoiceCall(...)

{incomingCall && (
  <div>
    <p>{incomingCall.callerName} is calling...</p>
    <button onClick={acceptCall}>Accept</button>
    <button onClick={declineCall}>Decline</button>
  </div>
)}
```

### Audio Controls

```tsx
const { isMuted, isDeafened, toggleMute, toggleDeafen, endCall } = useVoiceCall(...)

<button onClick={toggleMute}>{isMuted ? '🔇' : '🎤'}</button>
<button onClick={toggleDeafen}>{isDeafened ? '🔇' : '🔊'}</button>
<button onClick={endCall}>End Call</button>
```

### Spatial Audio Updates

```tsx
const { updateLocalPosition, updatePeerPosition } = useVoiceCall(...)

// Update local position when player moves
const handlePlayerMove = (position) => {
  sendPosition(position, direction)
  updateLocalPosition(position)  // For spatial audio
}

// Update peer positions (automatic via useEffect)
useEffect(() => {
  players.forEach(player => updatePeerPosition(player.id, player.position))
}, [players])
```

## TURN Server (Optional)

For production environments where STUN alone may not work (restrictive NATs, firewalls):

```bash
# Start with TURN server
docker-compose -f docker-compose.yml -f docker-compose.coturn.yml up -d
```

Configure credentials in `.env`:
```env
TURN_USERNAME=devpulse
TURN_PASSWORD=your-secure-password
HOST_IP=your-server-ip
```

## ICE Servers Configuration

Default configuration (free):

```typescript
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
]
```

With TURN server:

```typescript
const ICE_SERVERS = [
  // ... STUN servers
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'username',
    credential: 'password',
  },
]
```

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ✅ Edge 80+

Requires HTTPS in production (WebRTC getUserMedia requirement).

## Debugging

Enable verbose logging:

```typescript
// In use-voice-call.ts
peer.on('signal', (data) => {
  console.log('[VoiceCall] Signal:', data)
})

peer.on('connect', () => {
  console.log('[VoiceCall] Peer connected!')
})

peer.on('error', (err) => {
  console.error('[VoiceCall] Error:', err)
})
```

Check WebRTC internals: `chrome://webrtc-internals`

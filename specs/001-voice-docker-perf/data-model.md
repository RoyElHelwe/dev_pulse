# Data Model: Voice Call & Docker Performance Analysis

**Feature**: 001-voice-docker-perf  
**Date**: 2026-02-02  
**Status**: Complete

## Overview

This feature primarily involves optimization of existing data structures rather than new entities. The key changes are:
1. Enhanced state tracking for reconnection
2. New metrics collection for call quality monitoring
3. Redis-based call persistence for socket reconnection resilience

## Entity Updates

### 1. PeerConnection (Enhanced)

**Location**: `apps/web/lib/hooks/use-voice-call.ts`

```typescript
interface PeerConnection {
  // Existing fields
  peerId: string;
  peerName: string;
  peer: SimplePeerInstance;
  stream?: MediaStream;
  position?: Position;
  audioElement?: HTMLAudioElement;
  gainNode?: GainNode;
  pannerNode?: StereoPannerNode;
  statsInterval?: NodeJS.Timeout;
  
  // NEW: Reconnection state tracking
  iceState: RTCIceConnectionState;
  lastConnectedAt?: Date;
  reconnectionAttempts: number;
  
  // NEW: Audio source node for proper cleanup
  sourceNode?: MediaStreamAudioSourceNode;
}
```

**Validation Rules**:
- `reconnectionAttempts` must not exceed 3 before triggering full reconnect
- `lastConnectedAt` must be set when `iceState` transitions to `connected`

---

### 2. CallState (Enhanced)

**Location**: `apps/web/lib/hooks/use-voice-call.ts`

```typescript
export type CallStatus = 
  | 'idle' 
  | 'calling' 
  | 'ringing' 
  | 'connecting' 
  | 'connected'
  | 'reconnecting'  // NEW: ICE restart in progress
  | 'ended' 
  | 'failed'
  | 'declined';

// NEW: Reconnection state
interface ReconnectionState {
  isReconnecting: boolean;
  countdown: number;         // Seconds remaining (0-30)
  attempt: number;           // Current attempt (1-3)
  startedAt: Date;
}
```

**State Transitions**:
```
idle → calling → ringing → connecting → connected
                                    ↓
                              reconnecting (on ICE disconnect)
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
              connected (success)              failed (timeout/exhausted)
```

---

### 3. CallQualityStats (Enhanced)

**Location**: `apps/web/lib/hooks/use-voice-call.ts`

```typescript
interface CallQualityStats {
  peerId: string;
  
  // Existing metrics
  packetsLost: number;
  packetsReceived: number;
  jitter: number;              // in milliseconds
  roundTripTime: number;       // in milliseconds
  bytesReceived: number;
  timestamp: number;
  
  // NEW: Derived quality indicators
  packetLossRate: number;      // percentage (0-100)
  qualityScore: 'excellent' | 'good' | 'fair' | 'poor';
  
  // NEW: Trend tracking
  jitterTrend: 'stable' | 'increasing' | 'decreasing';
  previousSamples: number[];   // Last 5 jitter samples for trend
}
```

**Quality Score Calculation**:
```typescript
function calculateQualityScore(stats: CallQualityStats): string {
  const lossRate = stats.packetLossRate;
  const jitter = stats.jitter;
  const rtt = stats.roundTripTime;
  
  if (lossRate < 1 && jitter < 30 && rtt < 150) return 'excellent';
  if (lossRate < 3 && jitter < 50 && rtt < 250) return 'good';
  if (lossRate < 5 && jitter < 100 && rtt < 400) return 'fair';
  return 'poor';
}
```

---

### 4. ActiveCall (Server-Side Enhancement)

**Location**: `apps/api-gateway/src/websocket/websocket.gateway.ts`

```typescript
interface ActiveCallRecord {
  callKey: string;              // `call:${workspaceId}`
  participants: Set<string>;    // userIds
  createdAt: Date;
  lastActivity: Date;
  
  // NEW: For Redis persistence
  workspaceId: string;
  initiatorId: string;
}

// Redis key structure
// Key: `voice:call:${workspaceId}` 
// Type: Set
// Value: participant userIds
// TTL: 3600 seconds (1 hour)
```

---

### 5. SignalBuffer (Enhanced)

**Location**: `apps/web/lib/hooks/use-voice-call.ts`

```typescript
interface BufferedSignal {
  signal: SimplePeer.SignalData;
  receivedAt: Date;
  fromUserId: string;
}

// Map<peerId, BufferedSignal[]>
// Max buffer size: 50 signals per peer
// Auto-cleanup: 30 seconds after first signal or on connection
```

**Validation Rules**:
- Buffer must not exceed 50 signals per peer (prevent memory growth)
- Signals older than 30 seconds must be discarded
- Buffer must be cleared when peer connection is established

---

## New Configuration Entities

### 6. DockerWatchConfig

**Location**: `docker-compose.yml` (environment variables)

```yaml
# Recommended configuration structure
environment:
  # File watching
  WATCHPACK_POLLING: "true"
  CHOKIDAR_USEPOLLING: "true"
  CHOKIDAR_INTERVAL: "300"        # milliseconds
  WATCHPACK_POLL_INTERVAL: "300"  # milliseconds
  
  # Resource limits (in deploy section)
  # memory: 2G (web), 1G (api-gateway)
```

### 7. NextWebpackWatchOptions

**Location**: `apps/web/next.config.ts`

```typescript
interface WatchOptions {
  poll: number;              // Poll interval in ms
  aggregateTimeout: number;  // Debounce delay in ms
  ignored: string[];         // Glob patterns to ignore
}

// Recommended values
const watchOptions: WatchOptions = {
  poll: 300,
  aggregateTimeout: 200,
  ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**']
};
```

---

## State Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        useVoiceCall Hook                        │
├─────────────────────────────────────────────────────────────────┤
│  State                          │  Refs                         │
│  ├── callStatus                 │  ├── localStreamRef           │
│  ├── isMuted                    │  ├── peersRef (Map)           │
│  ├── isDeafened                 │  ├── audioContextRef          │
│  ├── activeCall                 │  ├── localPositionRef         │
│  ├── incomingCall               │  ├── pendingSignalsRef (Map)  │
│  ├── connectedPeers (Map)       │  ├── signalTimeoutsRef (Map)  │
│  ├── callQuality                │  └── reconnectionRef (NEW)    │
│  └── reconnectionState (NEW)    │                               │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Gateway (Server)                    │
├─────────────────────────────────────────────────────────────────┤
│  In-Memory Maps                 │  Redis (NEW)                  │
│  ├── onlineUsers                │  ├── voice:call:{workspaceId} │
│  ├── socketToUser               │  │   (Set of participant IDs) │
│  ├── officePlayers              │  └── TTL: 1 hour              │
│  └── activeCalls                │                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Notes

No database migrations required. All changes are:
1. In-memory state structure enhancements (TypeScript interfaces)
2. Redis key additions (auto-created on first use)
3. Configuration file changes (docker-compose.yml, next.config.ts)

## Backward Compatibility

- All interface changes are additive (new optional fields)
- Existing socket events remain unchanged
- No breaking changes to public API

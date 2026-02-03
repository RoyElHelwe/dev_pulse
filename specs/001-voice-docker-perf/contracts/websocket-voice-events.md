# WebSocket Voice Events Contract

**Feature**: 001-voice-docker-perf  
**Date**: 2026-02-02  
**Status**: Complete

## Overview

This document describes the WebSocket event contracts for the voice call feature. All events use Socket.IO with the `voice:` namespace prefix.

## Existing Events (No Changes)

These events remain unchanged:

| Event | Direction | Purpose |
|-------|-----------|---------|
| `voice:call-invite` | Client → Server → Client | Initiate call |
| `voice:call-accept` | Client → Server → Client | Accept incoming call |
| `voice:call-decline` | Client → Server → Client | Reject call |
| `voice:call-end` | Client → Server → Client | End active call |
| `voice:signal` | Client ↔ Server ↔ Client | WebRTC SDP/ICE exchange |
| `voice:call-invitation` | Server → Client | Incoming call notification |
| `voice:call-accepted` | Server → Client | Call was accepted |
| `voice:call-declined` | Server → Client | Call was declined |
| `voice:call-ended` | Server → Client | Call was ended by peer |

## Enhanced Events

### voice:call-ended (Enhanced)

**Direction**: Server → Client

**Previous Payload**:
```typescript
{
  fromUserId: string;
}
```

**New Payload**:
```typescript
{
  fromUserId: string;
  reason?: 'user_ended' | 'peer_disconnected' | 'timeout' | 'error';
}
```

### voice:rejoin-call (Enhanced)

**Direction**: Client → Server

**Payload**:
```typescript
{
  workspaceId: string;
  callId: string;
  userId: string;
  currentPeers?: string[];  // NEW: List of peers client thinks are in call
}
```

### voice:rejoin-success (Enhanced)

**Direction**: Server → Client

**Payload**:
```typescript
{
  callId: string;
  participants: string[];
  callDuration?: number;    // NEW: Seconds since call started
}
```

### voice:rejoin-failed (Enhanced)

**Direction**: Server → Client

**Payload**:
```typescript
{
  callId: string;
  reason: 'call_ended' | 'not_participant' | 'call_not_found';
}
```

## New Events

### voice:ice-restart-request

**Direction**: Client → Server → Client

**Purpose**: Request ICE restart when connection degrades

**Payload**:
```typescript
{
  workspaceId: string;
  targetUserId: string;
  fromUserId: string;
}
```

**Server Behavior**: Forward to target user if both participants are in active call

### voice:ice-restart-response

**Direction**: Client → Server → Client

**Purpose**: Acknowledge ICE restart request

**Payload**:
```typescript
{
  workspaceId: string;
  targetUserId: string;
  fromUserId: string;
  accepted: boolean;
}
```

### voice:quality-report

**Direction**: Client → Server (optional broadcast)

**Purpose**: Report call quality metrics for monitoring/analytics

**Payload**:
```typescript
{
  workspaceId: string;
  callId: string;
  peerId: string;
  metrics: {
    packetLossRate: number;    // 0-100 percentage
    jitter: number;            // milliseconds
    roundTripTime: number;     // milliseconds
    qualityScore: 'excellent' | 'good' | 'fair' | 'poor';
  };
  timestamp: number;
}
```

**Server Behavior**: Log metrics, optionally forward to peer for awareness

### voice:connection-state

**Direction**: Client → Server (informational)

**Purpose**: Inform server of connection state for cleanup decisions

**Payload**:
```typescript
{
  workspaceId: string;
  peerId: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting';
}
```

**Server Behavior**: Update internal tracking, trigger cleanup if needed

## Error Events

### voice:call-error (Enhanced)

**Direction**: Server → Client

**Previous Payload**:
```typescript
{
  message: string;
}
```

**New Payload**:
```typescript
{
  message: string;
  code: 'USER_OFFLINE' | 'CALLER_DISCONNECTED' | 'INVALID_STATE' | 'TIMEOUT' | 'UNKNOWN';
  recoverable: boolean;      // NEW: Hint if client should retry
  retryAfter?: number;       // NEW: Suggested retry delay in ms
}
```

## Event Flow Diagrams

### Normal Call Flow (Unchanged)
```
Caller                    Server                    Callee
  |                         |                         |
  |--- voice:call-invite -->|                         |
  |                         |--- voice:call-invitation-->|
  |                         |                         |
  |                         |<-- voice:call-accept ---|
  |<-- voice:call-accepted--|                         |
  |                         |                         |
  |======= WebRTC Signaling via voice:signal ========|
  |                         |                         |
  |<============= P2P Audio Connection ==============>|
```

### Reconnection Flow (New)
```
User A                    Server                    User B
  |                         |                         |
  |  [ICE disconnected]     |                         |
  |                         |                         |
  |--- voice:ice-restart-request -->|                 |
  |                         |--- voice:ice-restart-request -->|
  |                         |                         |
  |                         |<-- voice:ice-restart-response --|
  |<-- voice:ice-restart-response --|                 |
  |                         |                         |
  |======= New ICE candidates via voice:signal ======|
  |                         |                         |
  |<============= P2P Audio Restored ================>|
```

### Socket Reconnection Flow (Enhanced)
```
Client                    Server                    Redis
  |                         |                         |
  |  [Socket disconnected]  |                         |
  |                         |                         |
  |--- [Reconnects] ------->|                         |
  |--- voice:rejoin-call -->|                         |
  |                         |--- GET voice:call:* --->|
  |                         |<-- participant list ----|
  |                         |                         |
  |<-- voice:rejoin-success-|                         |
  |                         |                         |
  |  [Re-establish P2P or request new signals]        |
```

## Rate Limits

| Event | Limit | Window |
|-------|-------|--------|
| voice:call-invite | 3 | 10 seconds |
| voice:signal | 100 | 10 seconds |
| voice:ice-restart-request | 3 | 60 seconds |
| voice:quality-report | 1 | 5 seconds |

## Backward Compatibility

- All new fields in enhanced events are optional
- Clients not sending new fields will work with existing behavior
- New events can be ignored by older clients without error

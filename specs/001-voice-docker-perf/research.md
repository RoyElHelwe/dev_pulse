# Research: Voice Call & Docker Performance Analysis

**Feature**: 001-voice-docker-perf  
**Date**: 2026-02-02  
**Status**: Complete

## Research Tasks

### 1. WebRTC Memory Leak Patterns in React Hooks

**Task**: Identify common memory leak patterns in WebRTC + React and how they apply to useVoiceCall.ts

**Findings**:

**Decision**: Implement comprehensive cleanup in useEffect return functions and explicit resource tracking

**Rationale**: The current implementation has several leak vectors that accumulate over multiple call sessions:
1. Audio elements appended to document.body not always removed on error paths
2. MediaStream tracks may not be stopped if peer connection fails before stream event
3. Web Audio API nodes (GainNode, StereoPannerNode) not disconnected on all cleanup paths
4. Stats monitoring intervals not cleared if peer disconnects unexpectedly
5. Signal buffer timeouts can accumulate if peer never connects

**Alternatives Considered**:
- Using a third-party WebRTC wrapper (e.g., PeerJS) - Rejected: adds dependency, less control over cleanup
- Moving to Web Workers for audio processing - Rejected: complexity not justified for current scale

**Implementation Pattern**:
```typescript
// Recommended cleanup pattern
const cleanupPeer = useCallback((peerId: string) => {
  const pc = peersRef.current.get(peerId);
  if (!pc) return;
  
  // 1. Clear timers first (prevents new operations)
  if (pc.statsInterval) clearInterval(pc.statsInterval);
  
  // 2. Stop media tracks
  pc.stream?.getTracks().forEach(t => t.stop());
  
  // 3. Disconnect audio nodes (order matters: source → processing → destination)
  try {
    pc.gainNode?.disconnect();
    pc.pannerNode?.disconnect();
  } catch (e) { /* already disconnected */ }
  
  // 4. Remove DOM elements
  if (pc.audioElement) {
    pc.audioElement.pause();
    pc.audioElement.srcObject = null;
    pc.audioElement.remove();
  }
  
  // 5. Destroy peer connection last
  pc.peer.removeAllListeners();
  pc.peer.destroy();
  
  // 6. Clean up tracking
  peersRef.current.delete(peerId);
}, []);
```

---

### 2. Docker File Watching Performance (Chokidar/Watchpack)

**Task**: Understand why Docker volume mounts cause slow HMR and auto-refresh issues

**Findings**:

**Decision**: Optimize polling configuration and consider native inotify for Linux hosts

**Rationale**: Docker Desktop on macOS/Windows uses a virtualized filesystem that doesn't support native inotify events reliably. Current config uses polling but with suboptimal settings:

1. **Current Issues Identified**:
   - `CHOKIDAR_INTERVAL=1000` is too slow for responsive HMR (1 second delay)
   - `WATCHPACK_POLLING=true` enables polling but doesn't configure interval
   - No `ignored` patterns configured, causing node_modules to be watched
   - Multiple volume mounts create overlapping watch patterns

2. **Root Cause of Auto-Refresh**:
   - Polling can detect phantom changes when file timestamps update without content changes
   - Large number of watched files causes memory pressure → Next.js restart → full refresh
   - WebSocket HMR connection drops during container memory pressure → triggers refresh

**Alternatives Considered**:
- Using Docker's native file sync (gRPC FUSE) - Rejected: still has latency issues
- Disabling HMR entirely - Rejected: too impactful on development workflow
- Using rsync-based sync tools - Rejected: complexity, another tool to maintain

**Recommended Configuration**:
```yaml
# docker-compose.yml - web service
environment:
  - WATCHPACK_POLLING=true
  - CHOKIDAR_USEPOLLING=true
  - CHOKIDAR_INTERVAL=300          # Reduced from 1000ms
  - WATCHPACK_POLL_INTERVAL=300    # Match chokidar
  # Ignore patterns to reduce watch scope
  - NEXT_TELEMETRY_DISABLED=1
```

```javascript
// next.config.ts - add webpack config
webpack: (config, { dev }) => {
  if (dev) {
    config.watchOptions = {
      poll: 300,
      aggregateTimeout: 200,
      ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**']
    };
  }
  return config;
}
```

---

### 3. WebRTC Reconnection Best Practices

**Task**: Research automatic reconnection strategies for WebRTC when ICE connection fails

**Findings**:

**Decision**: Implement ICE restart on connection failure with 30-second timeout and user-visible countdown

**Rationale**: WebRTC connections can fail mid-call due to network changes (WiFi→cellular, VPN toggle, NAT rebinding). Simple peer destruction and recreation is costly; ICE restart is more efficient.

**Implementation Strategy**:
1. Monitor `iceConnectionState` changes on RTCPeerConnection
2. On `disconnected` state: start 30-second countdown, attempt ICE restart
3. On `failed` state: show reconnection UI, create new peer if ICE restart fails
4. On `connected` state: clear countdown, resume normal operation

**Code Pattern**:
```typescript
peer.on('iceStateChange', (state) => {
  if (state === 'disconnected') {
    startReconnectionCountdown();
    // Attempt ICE restart
    const pc = (peer as any)._pc as RTCPeerConnection;
    pc.restartIce();
  } else if (state === 'failed') {
    // ICE restart failed, need full reconnection
    showReconnectionPrompt();
  } else if (state === 'connected') {
    clearReconnectionCountdown();
  }
});
```

**Alternatives Considered**:
- Immediate call termination on disconnect - Rejected: poor UX for temporary network blips
- Infinite retry attempts - Rejected: wastes resources on permanent failures

---

### 4. Browser Tab Backgrounding and WebRTC

**Task**: Research how browsers throttle backgrounded tabs and impact on WebRTC calls

**Findings**:

**Decision**: Use audio element with `preservesPitch` and Page Visibility API to maintain call during backgrounding

**Rationale**: Modern browsers aggressively throttle backgrounded tabs:
- `setInterval`/`setTimeout` throttled to 1 second minimum
- WebSocket heartbeats may be delayed
- However, **active MediaStream connections are NOT throttled** to preserve call quality

**Key Insight**: WebRTC audio continues in background as long as:
1. An audio element is playing (even muted output keeps stream active)
2. The RTCPeerConnection remains connected

**Implementation**:
```typescript
// Ensure audio element prevents throttling
audioElement.autoplay = true;
audioElement.playsInline = true;
// Keep a hidden audio element playing to prevent throttling
// even if user's microphone is muted
```

**Page Visibility API for Quality Monitoring**:
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Reduce stats polling frequency to conserve resources
    reduceStatsPollingInterval();
  } else {
    // Restore normal monitoring
    restoreStatsPollingInterval();
  }
});
```

---

### 5. Socket.IO Reconnection and Voice Call State Sync

**Task**: Research how to maintain voice call state across socket reconnections

**Findings**:

**Decision**: Track active calls server-side and implement rejoin protocol on socket reconnect

**Rationale**: Current implementation partially handles this but has gaps:
- Server tracks `activeCalls` Map but doesn't persist across gateway restart
- Client has `voice:rejoin-call` event but race conditions exist if signals arrive during reconnection

**Improved Protocol**:
1. **On Socket Disconnect**: Client keeps WebRTC peer alive (P2P works without signaling once established)
2. **On Socket Reconnect**: Client emits `voice:rejoin-call` with current call state
3. **Server Response**: Either `voice:rejoin-success` with participant list or `voice:rejoin-failed`
4. **If Rejoin Fails**: Client attempts to re-establish call if peer is still connected

**Server-Side Enhancement**:
```typescript
// Store calls in Redis for persistence across gateway restarts
private async trackActiveCall(workspaceId: string, participants: string[]) {
  await this.redis.sadd(`voice:call:${workspaceId}`, ...participants);
  await this.redis.expire(`voice:call:${workspaceId}`, 3600); // 1 hour TTL
}
```

---

### 6. Web Audio API Performance Optimization

**Task**: Research efficient spatial audio updates to prevent audio glitches

**Findings**:

**Decision**: Use `linearRampToValueAtTime` instead of `setValueAtTime` for smooth transitions

**Rationale**: Abrupt value changes cause audio clicks/pops. Linear ramping over short duration (50ms) provides smooth transitions without perceptible delay.

**Current Issue**:
```typescript
// Current: can cause clicks
gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
```

**Optimized Approach**:
```typescript
// Smooth: ramp over 50ms prevents clicks
const now = audioContext.currentTime;
gainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
pannerNode.pan.linearRampToValueAtTime(pan, now + 0.05);
```

**Additional Optimization**: Throttle position updates to max 10Hz (100ms) since human perception can't distinguish more frequent audio position changes.

---

## Summary of Decisions

| Area | Decision | Impact |
|------|----------|--------|
| Memory Leaks | Explicit cleanup order: timers → tracks → nodes → DOM → peer | Eliminates all identified leak vectors |
| Docker HMR | Reduce poll interval to 300ms, add ignored patterns | Faster HMR, reduced CPU usage |
| Reconnection | ICE restart first, full reconnect as fallback, 30s timeout | Better UX for temporary network issues |
| Tab Backgrounding | Keep audio element playing, reduce monitoring in background | Call continues in background |
| Socket Reconnect | Server-side call tracking in Redis, rejoin protocol | Calls survive brief disconnects |
| Spatial Audio | Linear ramp transitions, throttle to 10Hz | No audio glitches during movement |

## Open Questions (for implementation)

1. Should we add a "call health" indicator in the UI showing connection quality?
2. Should Docker memory limits be configurable via .env file?
3. Should we implement a "low bandwidth mode" that disables spatial audio?

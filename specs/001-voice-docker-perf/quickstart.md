# Quickstart: Voice Call & Docker Performance Verification

**Feature**: 001-voice-docker-perf  
**Date**: 2026-02-02

## Prerequisites

- Docker Desktop running with 8GB+ memory allocated
- Two browser windows/tabs (or two devices on same network)
- Microphone access

## Quick Verification Tests

### Test 1: Memory Leak Detection (5 minutes)

**Purpose**: Verify memory cleanup after multiple calls

**Steps**:
1. Open Chrome DevTools → Memory tab
2. Take heap snapshot (baseline)
3. Make a voice call, talk for 30 seconds, end call
4. Repeat steps 3 five more times (6 total calls)
5. Take another heap snapshot

**Expected Result**:
- Memory difference should be <20% of baseline
- No `HTMLAudioElement` retained after calls
- No `SimplePeer` instances retained after calls

**Pass Criteria**: `SC-003` - Memory returns to within 20% of baseline

---

### Test 2: HMR Response Time (2 minutes)

**Purpose**: Verify Docker file watching performance

**Steps**:
1. Start Docker environment: `docker-compose up -d`
2. Open browser to `http://localhost:3000`
3. Open DevTools → Network tab
4. Edit `apps/web/app/layout.tsx` - change any text string
5. Save file and start timer
6. Stop timer when browser reflects change

**Expected Result**:
- Change reflected in <3 seconds
- No full page refresh (HMR only)
- No console errors

**Pass Criteria**: `SC-004` - HMR under 3 seconds for 95% of changes

---

### Test 3: Connection Reliability (3 minutes)

**Purpose**: Verify call connects reliably

**Steps**:
1. Open two browser windows, log in as different users
2. Both users join the same workspace office
3. User A clicks call button on User B's avatar
4. User B accepts call
5. Start timer from call initiation

**Expected Result**:
- Call connects in <5 seconds
- Both users can hear each other
- Console shows `[VoiceCall] ✅ Peer connected`

**Pass Criteria**: `SC-001` - Calls connect in <5 seconds for 95%

---

### Test 4: Reconnection Behavior (3 minutes)

**Purpose**: Verify graceful handling of network issues

**Steps**:
1. Establish a voice call between two users
2. In User A's browser, open DevTools → Network
3. Set network to "Offline" for 5 seconds
4. Set network back to "Online"
5. Observe reconnection behavior

**Expected Result**:
- UI shows "Reconnecting..." with countdown
- Call resumes after network restored
- Audio resumes without manual intervention

**Pass Criteria**: `SC-007` - Reconnection succeeds within 10 seconds

---

### Test 5: No Auto-Refresh (Background - 30 minutes)

**Purpose**: Verify Docker doesn't cause unexpected refreshes

**Steps**:
1. Start Docker environment
2. Open browser to `http://localhost:3000`
3. Leave browser tab open, don't make any file changes
4. Wait 30 minutes (or leave overnight for full test)
5. Check if page is still responsive

**Expected Result**:
- Page remains functional without refresh
- No console errors related to HMR disconnection
- WebSocket connection remains stable

**Pass Criteria**: `SC-005` - No auto-refresh during 4+ hour session

---

## Verification Commands

### Check Memory Limits
```bash
docker stats --no-stream
# Expected: web <2GB, api-gateway <1GB
```

### Check Active Connections
```bash
# In browser console while in call:
console.log('Peers:', window.__voiceCallDebug?.connectedPeers?.size || 0)
console.log('Audio elements:', document.querySelectorAll('[id^="voice-peer-"]').length)
```

### Check Docker File Watching
```bash
# Watch for file change events
docker-compose logs -f web 2>&1 | grep -i "compil\|build\|change"
```

### Check WebSocket Health
```bash
# In browser console:
console.log('Socket connected:', window.__socket?.connected)
console.log('Socket ID:', window.__socket?.id)
```

## Troubleshooting

### HMR Not Working
```bash
# Restart web container
docker-compose restart web

# Check polling is enabled
docker-compose exec web env | grep -i "poll\|chokidar"
```

### Memory Growing
```javascript
// In browser console - force cleanup
window.__voiceCallDebug?.cleanupAllPeers?.()
```

### Call Won't Connect
```bash
# Check WebSocket gateway logs
docker-compose logs api-gateway | grep -i "voice\|signal"
```

## Success Metrics Summary

| Metric | Target | Test |
|--------|--------|------|
| SC-001 | <5s connection | Test 3 |
| SC-003 | <20% memory growth | Test 1 |
| SC-004 | <3s HMR | Test 2 |
| SC-005 | No auto-refresh | Test 5 |
| SC-007 | Reconnection <10s | Test 4 |

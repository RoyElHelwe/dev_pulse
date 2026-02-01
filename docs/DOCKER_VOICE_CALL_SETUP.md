# Voice Call Implementation - Docker Setup & Debugging Guide

## ✅ Status: FIXED & RUNNING

Your Docker environment is now fully configured with the WebRTC voice call feature. All containers have been rebuilt and are running successfully.

## 🐳 Docker Containers Status

```
✔ web                (https://localhost:3000)       - Next.js Frontend
✔ api-gateway        (https://localhost:4000)       - NestJS Backend + WebSocket
✔ auth-service       (port 3001)                    - Authentication Service
✔ workspace-service  (port 3002)                    - Workspace Service
✔ task-service       (port 3003)                    - Task Management Service
✔ postgres           (port 5432)                    - Database
✔ redis              (port 6379)                    - Cache & Real-time
✔ nats               (port 4222)                    - Message Queue
✔ mailpit            (port 1025)                    - Email Testing
```

## 🔧 What Was Fixed

### TypeScript Compilation Errors
✅ Fixed circular dependency in `useVoiceCall` hook between `createPeerConnection` and `cleanupPeer`
✅ Fixed variable name shadowing (duplicate `peerConnection` declarations)
✅ Fixed `playsInline` property casting for audio elements
✅ Simplified error handling and added comprehensive console logging

### Docker Build
✅ Rebuilt all Docker images with fixed code
✅ Dependencies (simple-peer, @types/simple-peer) now installed in containers
✅ All services started successfully

## 🎯 Testing the Voice Call Feature

### Step 1: Access the Application

```bash
# Open in browser
https://localhost:3000

# Login with test credentials
# The app will auto-create workspace and office
```

### Step 2: Test Voice Calls

1. **Open Two Browser Windows/Tabs:**
   - Window 1: User A
   - Window 2: User B (or different user)

2. **Navigate to Office:**
   - Both users should see each other in the "Nearby" panel
   - Should see green dot with "Nearby (1)" indicator

3. **Initiate Call:**
   - User A clicks the 📞 (phone icon) next to User B
   - User B should see incoming call modal
   - Look in browser console for logs:
     ```
     [VoiceCall] 📞 startCall: {...}
     [VoiceCall] ✅ Starting call...
     [VoiceCall] 🎤 Requesting microphone access...
     [VoiceCall] 📡 Sending call invitation...
     [VoiceCall] 🔌 Creating peer connection...
     ```

4. **Accept Call:**
   - User B clicks "Accept" button
   - Should see "Connecting..." status
   - After 2-5 seconds, should see "Connected"

5. **Audio Test:**
   - Speak into microphone
   - Should hear peer's audio (may need to approve microphone twice)
   - Check console logs for audio events:
     ```
     [VoiceCall] ✅ Microphone access granted
     [VoiceCall] 🔊 Received remote stream
     [VoiceCall] ✅ Audio graph connected for spatial audio
     ```

## 📊 Console Logging Guide

When you press the call button, you should see logs like:

```javascript
// Initiator side (caller)
[VoiceCall] 📞 startCall: {targetUserId: "...", callStatus: "idle", socketReady: true}
[VoiceCall] ✅ Starting call...
[VoiceCall] 🎤 Requesting microphone access...
[VoiceCall] ✅ Microphone access granted, audio tracks: 1
[VoiceCall] 📡 Sending call invitation...
[VoiceCall] 🔌 Creating peer connection (initiator: true)
[VoiceCall] 📡 Sending signal: offer
[VoiceCall] 📡 Sending signal: candidate
[VoiceCall] 📡 Sending signal: candidate
...

// Recipient side (callee)
[VoiceCall] 📞 Incoming call from User A
[VoiceCall] ✅ Call accepted
[VoiceCall] 🔌 Creating peer connection (initiator: false)
[VoiceCall] 📡 Sending signal: answer
[VoiceCall] 📡 Sending signal: candidate
[VoiceCall] ✅ Peer connected
[VoiceCall] 🔊 Received remote stream
[VoiceCall] ✅ Audio graph connected for spatial audio
```

## 🐛 Troubleshooting

### "Nothing happens when I click call button"

**Check these in browser console (F12):**

1. **Is socket connected?**
   ```javascript
   console.log('Socket connected:', window.socket?.connected)
   ```

2. **Are errors occurring?**
   - Look for red errors in console
   - Search for `[VoiceCall] ❌`

3. **Microphone permission?**
   - Browser will ask for permission first time
   - Check if permission was denied:
     ```
     [VoiceCall] ❌ Microphone permission denied by user
     ```

4. **Is the peer nearby?**
   - Both users must be visible in "Nearby (X)" panel
   - If not nearby, manually move players closer (if using office map)

### "Socket not available"

**Solutions:**
```bash
# Check API gateway is running
docker-compose logs api-gateway | grep "WebSocket\|listening"

# Should show:
# ✔ WebSocket gateway initialized
# ✔ listening on port 4000

# Verify ports are accessible
netstat -an | grep 4000  # API gateway
netstat -an | grep 3000  # Web app
```

### "Microphone not working"

**Check:**
1. Browser permissions: `chrome://settings/content/microphone`
2. OS-level permission in System Preferences
3. Test with: `navigator.mediaDevices.getUserMedia({audio: true})`
4. Check for "[VoiceCall] ❌ Failed to get microphone access" in logs

### "Call connects but no audio"

**Check in console:**
```javascript
// Check audio context state
console.log('AudioContext state:', new (window.AudioContext || window.webkitAudioContext)().state)

// Check peer connection state  
// Should show: 'connected' after ~3-5 seconds
```

## 📋 Key Files

| File | Purpose |
|------|---------|
| `apps/web/lib/hooks/use-voice-call.ts` | Main React hook for WebRTC calls |
| `apps/web/components/voice/VoiceCallUI.tsx` | UI components for calls |
| `apps/api-gateway/src/websocket/websocket.gateway.ts` | Backend signaling server |
| `apps/web/app/(dashboard)/office/page.tsx` | Office integration |

## 🔄 Docker Commands

```bash
# View logs
docker-compose logs -f api-gateway      # API gateway logs
docker-compose logs -f web              # Web app logs
docker-compose logs -f                  # All services

# Restart services
docker-compose restart api-gateway      # Restart just API
docker-compose restart                  # Restart all

# Stop and start
docker-compose down
docker-compose up -d

# Full rebuild
docker-compose build --no-cache
docker-compose up -d
```

## 🚀 Next Steps

1. **Test calling functionality** - Try calling between two windows
2. **Test spatial audio** - Move players and listen to volume/pan changes
3. **Test error handling** - Try disconnecting network, denying permissions, etc.
4. **Performance monitoring** - Check DevTools Performance tab
5. **Multiple calls** - Test calling multiple users simultaneously

## 📞 Voice Call Socket Events

All WebSocket events for voice calls are prefixed with `voice:`

| Event | Direction | Purpose |
|-------|-----------|---------|
| `voice:call-invite` | Client → Server → Client | Initiate call |
| `voice:call-accept` | Client → Server → Client | Accept incoming call |
| `voice:call-decline` | Client → Server → Client | Reject call |
| `voice:call-end` | Client → Server → Client | End active call |
| `voice:signal` | Client ↔ Server ↔ Client | WebRTC SDP/ICE exchange |

## ℹ️ Support & Documentation

For more details, see:
- `docs/VOICE_CALL_IMPLEMENTATION.md` - Full technical documentation
- `docs/VOICE_CALL_TESTING_GUIDE.md` - Comprehensive testing guide
- `docs/REALTIME_COMMUNICATION_AUDIT.md` - Architecture overview

---

**Last Updated:** February 1, 2026
**Status:** ✅ All Systems Operational

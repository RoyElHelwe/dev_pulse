# WebRTC Voice Call Testing Guide

This guide provides step-by-step instructions to test the complete WebRTC voice call implementation for the 2D virtual office.

## Table of Contents

1. [Pre-Testing Setup](#pre-testing-setup)
2. [Phase 1: Local Development Setup](#phase-1-local-development-setup)
3. [Phase 2: Backend Verification](#phase-2-backend-verification)
4. [Phase 3: Frontend Setup & Browser Testing](#phase-3-frontend-setup--browser-testing)
5. [Phase 4: WebRTC Connection Testing](#phase-4-webrtc-connection-testing)
6. [Phase 5: Audio & Spatial Audio Testing](#phase-5-audio--spatial-audio-testing)
7. [Phase 6: UI Component Testing](#phase-6-ui-component-testing)
8. [Phase 7: Integration Testing](#phase-7-integration-testing)
9. [Phase 8: Error Handling & Edge Cases](#phase-8-error-handling--edge-cases)
10. [Phase 9: Docker Deployment Testing](#phase-9-docker-deployment-testing)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Performance Monitoring](#performance-monitoring)

---

## Pre-Testing Setup

### Prerequisites

Ensure you have the following installed and available:

```bash
# Node.js and npm
node --version  # Should be v16+ (v18+ recommended)
npm --version   # Should be v8+

# Docker (for Docker testing)
docker --version
docker-compose --version

# Browser DevTools
# Chrome: DevTools (F12)
# Firefox: Developer Tools (F12)

# Testing tools
# - Browser console (for logs)
# - Network tab (for socket events)
# - Performance tab (for audio processing)
```

### Browser Compatibility Check

Test in multiple browsers:
- ✅ Chrome/Chromium (best WebRTC support)
- ✅ Firefox (good WebRTC support)
- ⚠️ Safari (WebRTC support varies)
- ⚠️ Edge (good WebRTC support)

**Note**: Spatial audio (StereoPannerNode) requires modern browsers with Web Audio API support.

### Network Configuration

```bash
# Check connectivity
ping stun.l.google.com  # Google STUN server
ping stun1.l.google.com

# Check if ports are accessible
# STUN uses UDP port 3478
# TURN uses TCP/UDP ports 3478-3479 (if using coturn)
```

---

## Phase 1: Local Development Setup

### Step 1.1: Install Dependencies

```bash
cd /sgoinfre/ahmmanso/dev_pulse

# Install all workspace dependencies
npm install

# Verify simple-peer is installed
npm list simple-peer

# Expected output:
# ├── simple-peer@9.11.1
# └── @types/simple-peer@9.11.8
```

**Verification**:
- [ ] No dependency resolution errors
- [ ] simple-peer and @types/simple-peer are installed
- [ ] No peer dependency warnings for WebRTC-related packages

### Step 1.2: Verify File Structure

```bash
# Check all required files exist
ls -la apps/web/lib/hooks/use-voice-call.ts
ls -la apps/web/components/voice/VoiceCallUI.tsx
ls -la apps/web/components/voice/index.ts
ls -la apps/api-gateway/src/websocket/websocket.gateway.ts
ls -la apps/web/app/\(dashboard\)/office/page.tsx

# Check documentation exists
ls -la docs/VOICE_CALL_IMPLEMENTATION.md
ls -la docs/REALTIME_COMMUNICATION_AUDIT.md
```

**Verification**:
- [ ] All files exist
- [ ] No permission errors when listing

### Step 1.3: Check Build Configuration

```bash
# Verify Next.js config supports server components
cat apps/web/next.config.js | grep -i experimental

# Verify NestJS WebSocket gateway enabled
cat apps/api-gateway/src/app.module.ts | grep -i websocket
```

**Verification**:
- [ ] Next.js config looks correct
- [ ] WebSocketGateway is imported in app module

---

## Phase 2: Backend Verification

### Step 2.1: Build and Start Backend

```bash
# Build API gateway
npm run build -w @dev-pulse/api-gateway

# Start API gateway (should listen on port 3001)
npm run start:dev -w @dev-pulse/api-gateway
```

**Expected Output**:
```
[Nest] 12345 - 01/01/2025, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345 - 01/01/2025, 10:00:00 AM     LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 12345 - 01/01/2025, 10:00:00 AM     LOG [WebSocketGateway] WebSocket server listening on port 3001
```

**Verification**:
- [ ] No build errors
- [ ] API gateway starts successfully
- [ ] No port conflicts (should see port 3001)

### Step 2.2: Verify WebSocket Gateway Loads

```bash
# In API gateway logs, look for:
# - "WebsocketGateway initialized"
# - "Websocket server listening"
# - No errors about Socket.io configuration
```

**Verification**:
- [ ] WebSocket gateway initializes without errors
- [ ] Server is listening on correct port
- [ ] No CORS configuration errors

### Step 2.3: Test Backend Socket Connection

```bash
# Open browser DevTools console on http://localhost:3001
# Create a test script in DevTools console:

const socket = io('http://localhost:3001', {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  console.log('Connection ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

**Verification**:
- [ ] Socket connects successfully
- [ ] Connection ID is logged
- [ ] No connection errors in console

### Step 2.4: Verify Voice Signaling Events Registered

Check WebSocket gateway for voice event handlers:

```bash
# In code editor, search for: @SubscribeMessage('voice:call-invite')
# Should find 8 event handlers:

grep -n "voice:" apps/api-gateway/src/websocket/websocket.gateway.ts
```

Expected handlers:
- `voice:call-invite`
- `voice:call-accept`
- `voice:call-decline`
- `voice:call-end`
- `voice:signal`
- `voice:enable-proximity`
- `voice:disable-proximity`

**Verification**:
- [ ] All 7+ event handlers found
- [ ] Event handlers are decorated with @SubscribeMessage()
- [ ] Handlers have proper Socket and MessageBody parameters

### Step 2.5: Test Signal Forwarding

```bash
# From browser console (with two socket connections):

const socket1 = io('http://localhost:3001');
const socket2 = io('http://localhost:3001');

socket1.on('connect', () => {
  console.log('Socket 1 connected:', socket1.id);
  
  // Listen for signals from socket2
  socket1.on('voice:signal', (data) => {
    console.log('Socket 1 received signal:', data);
  });
});

socket2.on('connect', () => {
  console.log('Socket 2 connected:', socket2.id);
  
  // Send a test signal
  socket2.emit('voice:signal', {
    targetId: socket1.id,
    signal: { type: 'offer', data: 'test' }
  });
});
```

**Verification**:
- [ ] Socket 1 receives signal sent from Socket 2
- [ ] Signal data is passed correctly
- [ ] No server errors in backend logs

---

## Phase 3: Frontend Setup & Browser Testing

### Step 3.1: Install Frontend Dependencies

```bash
# Install frontend dependencies (if not already done)
npm install -w @dev-pulse/web

# Verify simple-peer is available
npm list -w @dev-pulse/web simple-peer
```

**Verification**:
- [ ] simple-peer installed in web app
- [ ] No TypeScript errors related to simple-peer imports

### Step 3.2: Build Frontend

```bash
# Build the Next.js app
npm run build -w @dev-pulse/web

# Expected output should show no critical errors
# Watch for warnings about:
# - Use of 'client' directive
# - Async components in server components
```

**Verification**:
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No import resolution errors for voice call components

### Step 3.3: Start Frontend Development Server

```bash
# In a new terminal, start Next.js dev server
npm run dev -w @dev-pulse/web

# Expected: app runs on http://localhost:3000
```

**Expected Output**:
```
  ▲ Next.js 14.0.0
  ✓ Ready in 1.2s
  ✓ Compiled client and server successfully
  ▲ GET / 200
```

**Verification**:
- [ ] Next.js server starts
- [ ] App available at http://localhost:3000
- [ ] No compilation errors

### Step 3.4: Open Application in Browser

```bash
# Open http://localhost:3000 in browser
# Navigate to the office page

# Check browser console for errors
# Look for:
console.log('Voice call hook initialized')
```

**Verification**:
- [ ] Application loads without 404 errors
- [ ] Office page loads
- [ ] Console shows no critical errors
- [ ] No CORS errors in Network tab

### Step 3.5: Check Frontend Socket Connection

```bash
# In browser console:
console.log('Check if socket is connected in page context');

// Check Network tab
// Look for WebSocket connection to localhost:3001
// URL should show: ws://localhost:3001/socket.io/...
```

**Verification**:
- [ ] WebSocket appears in Network tab
- [ ] Connection status shows "101 Web Socket Protocol Handshake"
- [ ] No connection errors

---

## Phase 4: WebRTC Connection Testing

### Step 4.1: Verify STUN Server Connectivity

```bash
# In browser console, test STUN server access:

const stunServers = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stunprotocol.org:3478'
];

// Browser will test these automatically when creating PeerConnection
// Check DevTools > Network tab for STUN queries
```

**Verification**:
- [ ] STUN queries appear in Network tab (UDP packets)
- [ ] No STUN timeouts visible in console
- [ ] Browser has access to external internet

### Step 4.2: Test Simple-Peer Instantiation

```bash
// In browser console:

const testPeer = new SimplePeer({
  initiator: false,
  trickle: true,
  streams: [],
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
});

testPeer.on('error', (err) => {
  console.error('SimplePeer error:', err);
});

testPeer.on('signal', (data) => {
  console.log('SimplePeer signal generated:', data);
});

console.log('SimplePeer instance created:', testPeer);
```

**Verification**:
- [ ] No errors creating SimplePeer instance
- [ ] Object is properly instantiated
- [ ] Event listeners are attached

### Step 4.3: Verify ICE Candidate Generation

```bash
// Continue from previous example or create new peer
// Monitor for ICE candidates

testPeer.on('signal', (data) => {
  if (data.type === 'offer' || data.type === 'answer') {
    console.log('SDP generated:', data.type);
  }
});

// Wait 5-10 seconds for ICE candidates
// Should see signal events with candidate data
```

**Verification**:
- [ ] SDP offer/answer is generated
- [ ] ICE candidates are collected
- [ ] No timeout waiting for ICE
- [ ] Check DevTools Network tab for STUN requests

### Step 4.4: Test Two-Peer Connection Simulation

Create a test script to simulate two peers connecting:

```javascript
// Create two SimplePeer instances
const peer1 = new SimplePeer({
  initiator: true,
  trickle: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
});

const peer2 = new SimplePeer({
  initiator: false,
  trickle: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
});

// Exchange signals
peer1.on('signal', (data) => {
  console.log('Peer1 signal:', data.type);
  peer2.signal(data);
});

peer2.on('signal', (data) => {
  console.log('Peer2 signal:', data.type);
  peer1.signal(data);
});

peer1.on('connect', () => {
  console.log('✅ Peer1 connected to Peer2');
});

peer2.on('connect', () => {
  console.log('✅ Peer2 connected to Peer1');
});

peer1.on('error', (err) => {
  console.error('Peer1 error:', err);
});

peer2.on('error', (err) => {
  console.error('Peer2 error:', err);
});
```

**Verification**:
- [ ] Both peers generate signals
- [ ] Signals exchanged between peers
- [ ] Both peers establish connection
- [ ] "connected" event fires on both peers
- [ ] No errors during connection establishment

---

## Phase 5: Audio & Spatial Audio Testing

### Step 5.1: Test Microphone Access

```bash
# In browser console:

navigator.mediaDevices.getUserMedia({ audio: true })
  .then((stream) => {
    console.log('✅ Microphone access granted');
    console.log('Audio tracks:', stream.getAudioTracks().length);
    
    // Stop the stream to avoid feedback
    stream.getTracks().forEach(track => track.stop());
  })
  .catch((err) => {
    console.error('❌ Microphone access denied:', err.name);
  });
```

**Verification**:
- [ ] Browser shows microphone permission prompt
- [ ] Permission is granted
- [ ] Audio tracks are available
- [ ] Stream stops cleanly

**Note**: Check browser settings:
- Chrome: chrome://settings/content/microphone
- Firefox: about:preferences#privacy
- Safari: System Preferences > Security & Privacy > Microphone

### Step 5.2: Test Web Audio API Initialization

```bash
// Test audio context and nodes

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
console.log('Audio Context state:', audioContext.state);
console.log('Sample rate:', audioContext.sampleRate);

// Create gain node for volume control
const gainNode = audioContext.createGain();
gainNode.gain.value = 0.5; // 50% volume
console.log('Gain Node created, value:', gainNode.gain.value);

// Create stereo panner for spatial audio
const pannerNode = audioContext.createStereoPanner();
pannerNode.pan.value = 0; // Center
console.log('Stereo Panner created, pan value:', pannerNode.pan.value);

// Test pan range
pannerNode.pan.value = -1; // Left
console.log('Pan left:', pannerNode.pan.value);
pannerNode.pan.value = 1; // Right
console.log('Pan right:', pannerNode.pan.value);
```

**Verification**:
- [ ] AudioContext created successfully
- [ ] State is "running"
- [ ] Sample rate is typical (44100 or 48000 Hz)
- [ ] Gain node created with proper value range [0, 1]
- [ ] Stereo panner created with pan range [-1, 1]

### Step 5.3: Test Spatial Audio Calculations

Create a test function to verify spatial audio formulas:

```javascript
// Test distance-based volume calculation
function calculateVolume(distance, minDistance = 50, maxDistance = 300) {
  return Math.max(0, 1 - (distance - minDistance) / (maxDistance - minDistance));
}

// Test panning calculation
function calculatePan(dx, panRange = 300) {
  return Math.max(-1, Math.min(1, dx / panRange));
}

// Test cases
console.log('Spatial Audio Calculations:');
console.log('Distance 0px (closest):', calculateVolume(0)); // Should be 1.0
console.log('Distance 50px (min):', calculateVolume(50)); // Should be 1.0
console.log('Distance 150px (mid):', calculateVolume(150)); // Should be ~0.5
console.log('Distance 300px (max):', calculateVolume(300)); // Should be 0.0
console.log('Distance 400px (beyond max):', calculateVolume(400)); // Should be 0.0

console.log('\nPanning Calculations:');
console.log('Left (-300px):', calculatePan(-300)); // Should be -1.0
console.log('Center (0px):', calculatePan(0)); // Should be 0.0
console.log('Right (300px):', calculatePan(300)); // Should be 1.0
console.log('Far right (600px):', calculatePan(600)); // Should be 1.0 (clamped)
```

**Verification**:
- [ ] Volume calculations match expected values
- [ ] Volume is 1.0 at minimum distance
- [ ] Volume is 0.0 at/beyond maximum distance
- [ ] Pan calculations clamp to [-1, 1]
- [ ] Pan is symmetric around center

### Step 5.4: Test Web Audio Graph Connection

```javascript
// Test complete audio graph

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

navigator.mediaDevices.getUserMedia({ audio: true })
  .then((stream) => {
    // Create source from microphone stream
    const source = audioContext.createMediaStreamSource(stream);
    
    // Create gain (volume) node
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.5;
    
    // Create panner (stereo) node
    const pannerNode = audioContext.createStereoPanner();
    pannerNode.pan.value = -0.5;
    
    // Connect: source -> gain -> panner -> destination
    source.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(audioContext.destination);
    
    console.log('✅ Audio graph connected successfully');
    console.log('Flow: Microphone -> Gain -> Panner -> Speakers');
    
    // Test volume adjustment
    gainNode.gain.value = 0.2;
    console.log('Volume reduced to 0.2');
    
    // Clean up
    setTimeout(() => {
      stream.getTracks().forEach(track => track.stop());
      console.log('Audio stream stopped');
    }, 3000);
  })
  .catch((err) => {
    console.error('Error accessing microphone:', err);
  });
```

**Verification**:
- [ ] Audio graph connects without errors
- [ ] Sound output works (can hear microphone through speakers)
- [ ] Gain adjustment affects volume
- [ ] Panner adjustment affects stereo positioning
- [ ] No audio feedback or distortion (after cleanup)

**Warning**: Use headphones or set volume low to avoid feedback!

### Step 5.5: Integration Test - useVoiceCall Hook

Open the office page and check hook initialization:

```javascript
// In browser console on office page:

// Check if voice call hook is active
// Look for these indicators:
// 1. Voice call UI component renders (check DOM)
// 2. Network tab shows WebSocket connection
// 3. Check Redux/state for call status

// Trigger microphone access by opening VoiceCallUI
// Should see permission prompt

// Verify in console:
console.log(navigator.mediaDevices); // Should exist
console.log(new AudioContext()); // Should work
```

**Verification**:
- [ ] Voice call UI renders on office page
- [ ] WebSocket connection established
- [ ] Microphone access can be requested
- [ ] No console errors about audio context

---

## Phase 6: UI Component Testing

### Step 6.1: Test VoiceCallUI Component Renders

```bash
# In browser, open DevTools > Elements
# Navigate to office page
# Search for: "VoiceCallUI" or "IncomingCallModal"

# Should find elements:
# - <IncomingCallModal />
# - <ActiveCallBar />
# - <ProximityVoiceIndicator />
```

**Verification**:
- [ ] VoiceCallUI component renders
- [ ] All child components present in DOM
- [ ] No React errors in console

### Step 6.2: Test Incoming Call Modal

Create a test to trigger incoming call:

```javascript
// Simulate incoming call event from websocket
// In browser console:

// First, setup socket listener to log events
window.socketRef = window.socketRef || {};

// In office page, the socket should be available
// Check if you can access it through the hook

// Manually trigger incoming call (if socket available):
socket.emit('voice:call-invitation', {
  callerId: 'test-user-123',
  callerName: 'Test Caller',
  callType: 'voice',
  timestamp: new Date().toISOString()
});

// Watch for UI changes
// Should see incoming call modal appear
```

**Verification**:
- [ ] Incoming call modal appears
- [ ] Shows caller name
- [ ] Accept button is clickable
- [ ] Decline button is clickable
- [ ] Modal has proper styling and is visible

### Step 6.3: Test Accept Call Button

```bash
# In browser with incoming call modal visible:

# Click "Accept" button
# Expected:
# 1. Modal disappears
# 2. ActiveCallBar appears
# 3. Audio connection initiates
# 4. Call status shows "connecting"
# 5. Duration timer starts

# Check console for:
# - "Call accepted"
# - WebRTC signal events
# - No errors
```

**Verification**:
- [ ] Modal closes on accept
- [ ] Active call bar appears
- [ ] Call status transitions to "connecting"
- [ ] Duration timer visible
- [ ] No errors in console

### Step 6.4: Test Decline Call Button

```bash
# Setup another incoming call

# Click "Decline" button
# Expected:
# 1. Modal disappears
# 2. No call is established
# 3. Console shows "Call declined"
# 4. Socket event sent to caller

# Check Network tab:
# Should see "voice:call-decline" event sent
```

**Verification**:
- [ ] Modal closes on decline
- [ ] No call connection initiated
- [ ] Decline event sent to peer
- [ ] Call status returns to idle

### Step 6.5: Test Active Call Bar Controls

With active call running:

```bash
# Test Mute Button:
# 1. Click mute icon
# 2. Should toggle muted state
# 3. Icon changes to show muted status
# 4. Audio from mic should stop
# 5. Socket event "voice:mute-toggle" sent

# Test Deafen Button:
# 1. Click deafen icon
# 2. Should toggle deafened state
# 3. Icon changes
# 4. Peer audio should stop playing
# 5. Socket event "voice:deafen-toggle" sent

# Test End Call Button:
# 1. Click end call icon
# 2. Call should terminate
# 3. Active call bar disappears
# 4. Modal closes
# 5. Audio streams cleaned up
# 6. "voice:call-end" event sent
```

**Verification**:
- [ ] Mute toggle works and reflects state
- [ ] Deafen toggle works and reflects state
- [ ] End call button properly terminates connection
- [ ] All state changes reflected in UI
- [ ] Socket events sent correctly

### Step 6.6: Test Proximity Voice Indicator

```bash
# Test proximity voice toggle:

# Look for proximity voice indicator in UI
# Should show toggle switch

# Click to enable proximity voice:
# 1. Icon/indicator changes state
# 2. "voice:enable-proximity" sent to server
# 3. Nearby players detected automatically
# 4. Calls initiated for players within range

# Click to disable:
# 1. Icon changes back
# 2. "voice:disable-proximity" sent to server
# 3. Auto-calls stop
# 4. Manual calls still work
```

**Verification**:
- [ ] Proximity indicator visible
- [ ] Toggle state changes
- [ ] Socket events sent
- [ ] Proximity detection activates/deactivates

### Step 6.7: Test Call Status Indicators

```bash
# Monitor call status bar text:

# "Connecting..." - WebRTC connection establishing
# Should see for 1-3 seconds typically

# "Connected" - Call is active
# Should see when audio is flowing

# Call duration timer counting up
# Format: "00:15" for 15 seconds

# Status messages in toast notifications
# "Call ended"
# "Call declined"
# "Call failed"
```

**Verification**:
- [ ] Status text changes appropriately
- [ ] Duration timer increments
- [ ] Notifications appear for call events
- [ ] Notifications auto-dismiss after 3-5s

---

## Phase 7: Integration Testing

### Step 7.1: Two-Browser Call Test

Setup two browser windows/tabs:

```bash
# Window 1: User A (alice@example.com)
# - Login to office
# - Position: x=100, y=100

# Window 2: User B (bob@example.com)
# - Login to same office
# - Position: x=150, y=150 (close to User A)

# Both should see each other as nearby players
# Test flow:
# 1. User A clicks on User B
# 2. Incoming call modal appears for User B
# 3. User B clicks Accept
# 4. Both see "Connecting..." status
# 5. After 2-5s, status changes to "Connected"
# 6. Audio should flow (if microphones work)
# 7. Both see active call bar
# 8. Duration counter increments
```

**Verification**:
- [ ] Call modal appears on recipient side
- [ ] Call connects in both directions
- [ ] Status updates synchronized
- [ ] Duration timer synced
- [ ] Both can mute/deafen
- [ ] Both can end call

### Step 7.2: Spatial Audio in Multi-Player Setup

With two browsers in call:

```bash
# User A settings:
# - Position: x=0, y=0
# - Muted: false

# User B positions (test different distances):

# Test 1: Very close (distance < 50px)
# - Position: x=40, y=0
# - Expected: Loud, centered

# Test 2: Medium distance (distance = 150px)
# - Position: x=150, y=0
# - Expected: Moderate volume, centered

# Test 3: Far (distance = 300px+)
# - Position: x=320, y=0
# - Expected: Silent or very quiet

# Test 4: Off to side (x offset)
# - Position: x=100, y=0 (same distance, check pan)
# - User B moves left:
#   - New position: x=50, y=150
#   - Expected: Pan left

# Use DevTools to monitor:
# - gainNode.gain.value (volume)
# - pannerNode.pan.value (stereo position)
```

**Verification**:
- [ ] Audio volume decreases with distance
- [ ] Audio pans left/right with horizontal offset
- [ ] Calculations match formula
- [ ] Smooth transitions as player moves
- [ ] Audio stays in sync with visual position

### Step 7.3: Proximity Voice Auto-Connection

```bash
# Setup scenario:
# User A at x=0, y=0, proximity voice ENABLED
# User B at x=150, y=0 (within 200px threshold)

# Expected:
# 1. Automatic call initiated from A to B
# 2. B sees incoming call automatically
# 3. B accepts (automatic if configured)
# 4. Call connects without manual interaction
# 5. Spatial audio applies automatically

# Test proximity exit:
# User B moves away (distance > 200px):
# Expected:
# 1. Call should end automatically
# 2. Both see call ended notification
# 3. Audio disconnects cleanly
```

**Verification**:
- [ ] Auto-call initiates at correct distance
- [ ] Call ends when out of range
- [ ] No manual intervention needed
- [ ] Smooth transitions as players move
- [ ] Multiple simultaneous proximity calls work

### Step 7.4: Call State Transitions

Test all state machine transitions:

```
Expected state flow:
idle
  ↓
calling (caller side) / ringing (callee side)
  ↓
connecting (both sides after accept)
  ↓
connected (when peer connection established)
  ↓
ended / declined / failed (terminal states)
  ↓
idle (reset)
```

Test by:
- [ ] Start call: idle → calling/ringing
- [ ] Accept call: ringing → connecting → connected
- [ ] Decline call: ringing → declined → idle
- [ ] End call: connected → ended → idle
- [ ] Failed connection: connecting → failed → idle

### Step 7.5: Multiple Simultaneous Calls

With 3+ users in office:

```bash
# User A: Center
# User B: Nearby (auto-call active)
# User C: Nearby (auto-call active)

# Expected:
# - Call A-B established
# - Call A-C established
# - Both calls active simultaneously
# - Spatial audio works for both
# - Muting A affects both calls
# - Ending one call doesn't affect other
```

**Verification**:
- [ ] Multiple peer connections managed
- [ ] No interference between calls
- [ ] Memory doesn't leak
- [ ] Audio mixes correctly
- [ ] Call metrics per peer tracked

---

## Phase 8: Error Handling & Edge Cases

### Step 8.1: No Microphone Permissions

```bash
# Deny microphone permission when prompted
# Expected:
# 1. Error caught in useVoiceCall hook
# 2. Error message shown to user
# 3. Call not initiated
# 4. Graceful fallback

# Check console for:
# - "NotAllowedError: Microphone access denied"
# - Error handler log
```

**Verification**:
- [ ] Permission denial handled gracefully
- [ ] User sees clear error message
- [ ] App doesn't crash
- [ ] Can try again later

### Step 8.2: Microphone Access Timeout

```bash
# Simulate timeout (take >10 seconds to approve permission)
# Expected:
# - Timeout detected
# - Error message shown
# - Call cancelled
```

**Verification**:
- [ ] Timeout detected and handled
- [ ] User not left in limbo
- [ ] Can retry call

### Step 8.3: Network Disconnection During Call

```bash
# While call is active:
# 1. Toggle browser offline mode (DevTools)
# 2. Or disconnect network physically
# 3. Or kill backend server

# Expected:
# 1. Connection loss detected
# 2. "Connection lost" message shown
# 3. Call terminates gracefully
# 4. Reconnection attempted
# 5. User notified of disconnection
```

**Verification**:
- [ ] Network loss detected quickly
- [ ] Call cleaned up properly
- [ ] No hanging connections
- [ ] Reconnection works
- [ ] User can retry

### Step 8.4: STUN Server Failure

```bash
# Test with STUN servers intentionally blocked:
# 1. In browser DevTools > Network tab
# 2. Block requests to "stun*.google.com"
# 3. Try to establish call

# Expected:
# 1. Fallback to other STUN servers works
# 2. Connection still possible (if other servers available)
# 3. Or graceful failure with error message
```

**Verification**:
- [ ] Multiple STUN servers used as fallback
- [ ] Doesn't fail if one server unavailable
- [ ] Clear error if all STUN servers fail

### Step 8.5: Peer Disconnection

```bash
# With active call:
# 1. Kill callee browser tab/window
# 2. Or close browser

# Expected for caller:
# 1. Detect peer disconnection quickly
# 2. Show "Peer disconnected" message
# 3. Clean up audio resources
# 4. Reset to idle state
# 5. Can initiate new call
```

**Verification**:
- [ ] Disconnection detected
- [ ] Cleanup happens promptly
- [ ] No resource leaks
- [ ] No error popups
- [ ] Can call again

### Step 8.6: Signal Delivery Failure

```bash
# Simulate server lag with DevTools throttling:
# 1. DevTools > Network > Throttling
# 2. Set to "Slow 4G" or offline
# 3. Try to establish call

# Expected:
# 1. Signal exchange delayed
# 2. Connection still succeeds (with delay)
# 3. Or timeout with error
# 4. Graceful failure if timeout
```

**Verification**:
- [ ] Connection tolerates network delays
- [ ] Timeout prevents indefinite waiting
- [ ] Error shown if signals can't exchange

### Step 8.7: Browser Back/Refresh During Call

```bash
# With active call:
# 1. Click browser back button
# 2. Or press Cmd+R / F5 to refresh
# 3. Or close tab

# Expected:
# 1. Call ends cleanly
# 2. Peer sees "call ended" notification
# 3. Peer's audio cleaned up
# 4. No zombie connections on server
```

**Verification**:
- [ ] Cleanup on page unload
# - [ ] Peer properly notified
# - [ ] No lingering connections

### Step 8.8: Audio Element Error Handling

```bash
# In browser console, during active call:

// Manually try to break audio playback
const audioElem = document.querySelector('audio[data-peer-id]');
if (audioElem) {
  audioElem.pause();
  audioElem.src = '';
}

// Expected:
// 1. Error detected in hook
# - [ ] Peer audio stops but call continues
// 3. Can try to reconnect
```

**Verification**:
- [ ] Audio element errors handled
- [ ] Call state maintained
- [ ] No cascading failures

---

## Phase 9: Docker Deployment Testing

### Step 9.1: Build Docker Images

```bash
# Build all services
docker-compose build

# Expected output:
# Building api-gateway ... done
# Building web ... done
# No build errors
```

**Verification**:
- [ ] All images build successfully
- [ ] No Dockerfile syntax errors
- [ ] Dependencies installed in containers

### Step 9.2: Start Docker Environment

```bash
# Start services
docker-compose up -d

# Check running containers
docker-compose ps

# Expected:
# All containers should show "Up"
```

**Verification**:
- [ ] All containers running
- [ ] No startup errors
- [ ] Ports properly mapped

### Step 9.3: Check Docker Logs

```bash
# Check API gateway logs
docker-compose logs api-gateway

# Expected: No errors, "listening on port 3001"

# Check web app logs
docker-compose logs web

# Expected: No build errors, "ready on port 3000"
```

**Verification**:
- [ ] No errors in API gateway startup
- [ ] No errors in web app startup
- [ ] All services initialized correctly

### Step 9.4: Test Application in Docker

```bash
# Open http://localhost:3000 in browser
# Navigate to office
# Test voice call flow

# Same tests as Phases 1-8 but in Docker environment
```

**Verification**:
- [ ] Application works in Docker
- [ ] WebSocket connects
- [ ] Voice calls work
# - [ ] Spatial audio functions

### Step 9.5: Optional: Test with Coturn TURN Server

```bash
# Build and run with coturn
docker-compose -f docker-compose.yml \
  -f docker-compose.coturn.yml up -d

# Check coturn logs
docker-compose logs coturn

# Expected: "TLS/DTLS listening on"

# Update ice servers in use-voice-call.ts to include:
# { urls: 'turn:localhost:3478', username: 'user', credential: 'pass' }

# Test calls with TURN enabled
```

**Verification**:
- [ ] Coturn container starts
- [ ] TURN server accessible
- [ ] Calls work with TURN (especially behind NAT)

---

## Troubleshooting Guide

### Issue: "Socket connection failed"

**Symptoms**: 
- Can't connect to WebSocket
- "Error: Connection refused" in console

**Solutions**:
```bash
# 1. Check API gateway running
npm run start:dev -w @dev-pulse/api-gateway

# 2. Check port 3001 not in use
lsof -i :3001

# 3. Check CORS configuration
grep -i cors apps/api-gateway/src/websocket/websocket.gateway.ts

# 4. Check firewall
# Ensure localhost:3001 accessible
```

### Issue: "Microphone permission denied"

**Symptoms**:
- Browser permission prompt blocked
- getUserMedia fails

**Solutions**:
```bash
# Check browser permissions:
# Chrome: chrome://settings/content/microphone
# Firefox: about:preferences#privacy
# Safari: System Preferences > Security & Privacy

# Reset permissions:
# Chrome: Clear site data for localhost
# Firefox: about:preferences > Privacy & Security > Permissions > Clear

# Test in private/incognito window
```

### Issue: "STUN server not responding"

**Symptoms**:
- ICE candidates not generated
- Slow connection or timeout

**Solutions**:
```bash
# Test STUN connectivity
ping stun.l.google.com
nslookup stun.l.google.com

# Check firewall allows UDP 3478
# Check ISP doesn't block STUN

# Try alternative STUN servers
# Edit use-voice-call.ts to use different servers
```

### Issue: "No audio heard"

**Symptoms**:
- Call connects but no sound
- Microphone not working

**Solutions**:
```javascript
// Test microphone
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    console.log('Audio input level:', Math.max(...dataArray));
  });

// Check speaker volume in OS
// Test with speaker/headphones
// Check browser tab audio settings
```

### Issue: "Call connects but audio is one-way"

**Symptoms**:
- Caller hears callee but not vice versa

**Solutions**:
```bash
# 1. Check both sides have audio tracks
# In console:
console.log('Has audio:', peer.streams[0]?.getAudioTracks().length > 0);

# 2. Check gain nodes on both sides
# Verify gainNode.gain.value > 0

# 3. Check audio element autoplay
# <audio autoplay playsinline muted={false} />

# 4. Check browser autoplay policy
# Some browsers require user interaction first

# 5. Verify SimpleP peer stream handling
# Check peer.on('stream') callback fires
```

### Issue: "Spatial audio not working"

**Symptoms**:
- Audio doesn't change volume/pan with distance
- Always same volume regardless of position

**Solutions**:
```javascript
// Check spatial audio enabled
console.log('Spatial audio config:', {
  maxDistance: 300,
  minDistance: 50,
  enabled: true
});

// Test gain node updates
const gainNode = peer.gainNode;
console.log('Initial gain:', gainNode.gain.value);
// Move player and check:
console.log('Updated gain:', gainNode.gain.value);

// Verify position updates being received
// Add logs in updatePeerPosition()
```

### Issue: "High latency/lag"

**Symptoms**:
- Delay between speaking and hearing
- Constant "Connecting..." status

**Solutions**:
```bash
# 1. Check network latency
ping localhost  # Should be <5ms
ping <server-ip>  # Check backend latency

# 2. Check for network throttling
# DevTools > Network tab > Throttling

# 3. Monitor connection state
# Check ICE candidates being collected
# Look for "relay" candidates (indicates NAT traversal)

# 4. Check CPU usage
# Audio processing might be slow

# 5. Try wired connection
# WiFi can be unreliable
```

### Issue: "Memory leak / growing memory usage"

**Symptoms**:
- Browser memory increases over time
- Tab becomes slow/unresponsive

**Solutions**:
```javascript
// Add cleanup logging to use-voice-call.ts
console.log('Closing peer connection');
console.log('Stopping audio tracks');
console.log('Cleaning up audio elements');

// Monitor peer count
console.log('Active peers:', Object.keys(peersRef.current).length);

// Force garbage collection (DevTools)
// Performance > Take heap snapshot > Compare

// Check for:
// - Audio elements not removed from DOM
// - Event listeners not removed
// - Peer connections not closed
// - MediaStream tracks not stopped
```

### Issue: "TypeError: SimplePeer is not a constructor"

**Symptoms**:
- SimplePeer import fails
- "Cannot read property of undefined"

**Solutions**:
```bash
# 1. Verify simple-peer installed
npm list simple-peer

# 2. Check import is correct
# Should be: import SimplePeer from 'simple-peer'

# 3. Rebuild project
npm run build -w @dev-pulse/web

# 4. Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# 5. Verify TypeScript types
npm list @types/simple-peer
```

### Issue: "Peers can't connect (P2P connection fails)"

**Symptoms**:
- SDP exchange works but connection never established
- Both sides stuck in "Connecting"

**Solutions**:
```bash
# 1. Check ICE server configuration
# Ensure at least one STUN server working

# 2. Test TURN server (if behind NAT)
# Add TURN server to iceServers array
# Test with coturn container

# 3. Check firewall
# Allow UDP 3478 (STUN)
# Allow TCP/UDP 3478-3479 (TURN)

# 4. Check network types
# Some networks block P2P
# Corporate firewalls often do

# 5. Monitor connection state in DevTools
# RTCPeerConnection.connectionState
# Should go: new -> connecting -> connected
```

---

## Performance Monitoring

### Browser DevTools Setup

#### Chrome/Chromium:

```bash
# Open DevTools (F12)
# Go to Network tab
# Filter: "voice:" to see signaling events
# Look for:
# - voice:call-invite
# - voice:call-accept
# - voice:signal (many events)
# - Duration and size of each

# Performance tab:
# Record during call
# Look for:
# - Audio processing spikes
# - Garbage collection pauses
# - Long tasks
```

#### Performance Metrics to Monitor:

```javascript
// Add to browser console to track performance

// 1. WebSocket latency
const startTime = performance.now();
socket.emit('voice:signal', {/* data */}, () => {
  const latency = performance.now() - startTime;
  console.log('Signal latency:', latency.toFixed(2), 'ms');
});

// 2. Audio processing
const audioContext = new AudioContext();
console.log('Audio context latency:', audioContext.baseLatency);

// 3. Memory usage (if available)
if (performance.memory) {
  console.log('Memory used:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');
  console.log('Memory limit:', (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2), 'MB');
}

// 4. Frame rate during call
let frames = 0;
const startFrames = performance.now();
function countFrames() {
  frames++;
  requestAnimationFrame(countFrames);
  if (performance.now() - startFrames > 1000) {
    console.log('FPS:', frames);
    frames = 0;
  }
}
countFrames();
```

### Expected Performance Targets:

- **WebSocket latency**: <50ms
- **Audio context latency**: <100ms
- **Frame rate**: 60 FPS (constant)
- **Memory usage**: <200MB for single call
- **CPU usage**: <20% for audio processing
- **ICE candidate collection**: <2s

### Monitoring Checklist:

- [ ] Signal exchange completes in <1s
- [ ] Call connects in <3s total
- [ ] Audio starts flowing within 5s
- [ ] No memory leaks over 30min call
- [ ] Spatial audio updates smooth (<100ms)
- [ ] No audio drops or stuttering
- [ ] CPU usage stays low during call
- [ ] No browser UI lag during audio

---

## Test Results Template

Use this template to document your testing:

```markdown
# Testing Results - [Date]

## Environment
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari/Edge] v[version]
- Node: [version]
- Backend: [Running/Docker]

## Phase 1: Setup
- [ ] Dependencies installed
- [ ] Files created correctly
- [ ] Build successful

## Phase 2: Backend
- [ ] API gateway running
- [ ] WebSocket listening
- [ ] Events registered
- [ ] Signal forwarding works

## Phase 3: Frontend
- [ ] Frontend builds
- [ ] App loads
- [ ] Socket connects

## Phase 4: WebRTC
- [ ] STUN connectivity OK
- [ ] SimplePeer instantiates
- [ ] ICE candidates generated
- [ ] Two-peer test successful

## Phase 5: Audio
- [ ] Microphone access works
- [ ] Web Audio API initialized
- [ ] Spatial audio calculations correct
- [ ] Audio graph connected

## Phase 6: UI
- [ ] Components render
- [ ] Incoming call modal works
- [ ] Accept/decline buttons work
- [ ] Active call bar updates
- [ ] Proximity indicator works

## Phase 7: Integration
- [ ] Two-browser call works
- [ ] Spatial audio in real scenario
- [ ] Proximity voice auto-calls
- [ ] State transitions smooth
- [ ] Multiple calls work

## Phase 8: Error Handling
- [ ] Microphone denial handled
- [ ] Network loss handled
- [ ] STUN failure handled
- [ ] Peer disconnection handled
- [ ] Page refresh handled

## Phase 9: Docker
- [ ] Images build
- [ ] Containers run
- [ ] App works in Docker
- [ ] Optional TURN server works

## Issues Found
1. [Issue]: [Description]
   - Status: [Fixed/Pending/Investigating]
   - Resolution: [If fixed]

## Performance
- Signal latency: [XX]ms
- Call connect time: [XX]s
- Memory usage: [XXX]MB
- CPU usage: [XX]%
- Audio quality: [Excellent/Good/Fair]

## Browser Compatibility
- Chrome: [Pass/Fail]
- Firefox: [Pass/Fail]
- Safari: [Pass/Fail]
- Edge: [Pass/Fail]

## Sign-off
- Tested by: [Name]
- Date: [Date]
- Approved: [Yes/No]
- Ready for production: [Yes/No]
```

---

## Quick Reference Commands

```bash
# Backend checks
npm run start:dev -w @dev-pulse/api-gateway      # Start API gateway
npm run build -w @dev-pulse/api-gateway          # Build backend
docker-compose logs api-gateway                   # Check backend logs

# Frontend checks
npm run dev -w @dev-pulse/web                    # Start Next.js dev
npm run build -w @dev-pulse/web                  # Build frontend
npm run lint -w @dev-pulse/web                   # Lint frontend

# Dependency checks
npm list simple-peer                              # Check simple-peer
npm list socket.io-client                         # Check socket.io
npm outdated                                      # Check for updates

# Docker commands
docker-compose up -d                             # Start all services
docker-compose down                              # Stop services
docker-compose logs -f                           # Follow logs
docker-compose ps                                # Check status

# Networking tests
ping stun.l.google.com                           # Test STUN server
curl -v http://localhost:3001                    # Test backend
curl -v http://localhost:3000                    # Test frontend
```

---

This comprehensive testing guide covers all aspects of the WebRTC implementation. Start with Phase 1 and work through sequentially, documenting results as you go. If issues arise, refer to the Troubleshooting Guide for solutions.

**Good luck with testing!**

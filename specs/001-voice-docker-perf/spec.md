# Feature Specification: Voice Call & Docker Performance Analysis

**Feature Branch**: `001-voice-docker-perf`  
**Created**: February 2, 2026  
**Status**: Draft  
**Input**: User description: "Analyze voice call feature for performance, stability, and reliability. Review WebRTC/socket handling, network usage, Docker configuration. Detect bugs, memory leaks, race conditions, dropped connections, excessive re-renders, or inefficient logic affecting call quality. Investigate Docker network slowness and auto-refresh issues. Suggest concrete improvements for speed, resource usage, and scalability."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voice Call Performance Audit (Priority: P1)

As a developer, I need to identify and fix performance issues in the voice call implementation so that users experience low-latency, high-quality audio calls without dropped connections, delays, or excessive resource consumption.

**Why this priority**: Voice call quality directly impacts user experience and is critical for the virtual office collaboration feature. Poor call quality leads to user abandonment and frustration.

**Independent Test**: Can be fully tested by conducting voice calls under various network conditions and measuring latency, jitter, packet loss, and CPU/memory usage. Delivers immediate improvement to call quality.

**Acceptance Scenarios**:

1. **Given** two users in a voice call, **When** the call is active for 30+ minutes, **Then** audio quality remains stable without degradation, memory usage stays constant, and no audio artifacts occur
2. **Given** a user with moderate network conditions (100ms latency, 2% packet loss), **When** they make a voice call, **Then** the call connects within 5 seconds and audio is understandable
3. **Given** multiple concurrent voice calls in the same workspace (3+ pairs), **When** all calls are active, **Then** server CPU stays below 70% and no calls experience quality degradation
4. **Given** a user who disconnects unexpectedly during a call, **When** they reconnect within 30 seconds, **Then** the call resumes automatically without requiring re-invitation

---

### User Story 2 - Memory Leak & Resource Cleanup (Priority: P1)

As a developer, I need to identify and eliminate memory leaks in the voice call system so that the application remains stable during extended use sessions without browser crashes or performance degradation.

**Why this priority**: Memory leaks cause progressive performance degradation and eventual browser crashes, severely impacting user experience during long work sessions.

**Independent Test**: Can be tested by starting/ending multiple voice calls and monitoring browser memory usage over time. Delivers stability improvements for all users.

**Acceptance Scenarios**:

1. **Given** a user who has made 10+ voice calls in a session, **When** all calls have ended, **Then** browser memory usage returns to within 20% of initial baseline
2. **Given** audio elements and WebRTC peer connections created during calls, **When** a call ends, **Then** all DOM elements are removed and all connections are properly closed within 5 seconds
3. **Given** an AudioContext created for spatial audio, **When** the user leaves the office, **Then** the AudioContext is properly closed and resources are released
4. **Given** buffered WebRTC signals stored during race conditions, **When** the connection is established or times out, **Then** all buffered signals are cleared and timeouts are cancelled

---

### User Story 3 - Docker Development Environment Performance (Priority: P1)

As a developer, I need to fix the slow performance and auto-refresh issues in the Docker development environment so that I can develop efficiently without waiting for slow hot module reloading or dealing with unexpected page refreshes.

**Why this priority**: Development productivity is severely impacted when the Docker environment is slow. This blocks all development work and team velocity.

**Independent Test**: Can be tested by making code changes and measuring HMR (Hot Module Reload) response time. Delivers immediate productivity improvement for the development team.

**Acceptance Scenarios**:

1. **Given** the Docker development environment is running, **When** a developer saves a file change, **Then** the browser reflects the change within 3 seconds (HMR)
2. **Given** the Docker containers are running for 4+ hours, **When** no file changes are made, **Then** the browser does not auto-refresh unexpectedly
3. **Given** multiple Docker containers running simultaneously, **When** monitoring resource usage, **Then** total memory usage stays below 6GB and CPU usage stays below 50% at idle
4. **Given** the web container with volume mounts, **When** file watching is active, **Then** inotify events are processed efficiently without excessive CPU polling

---

### User Story 4 - WebRTC Connection Reliability (Priority: P2)

As a user, I need voice calls to connect reliably across different network configurations (NAT, firewalls, VPNs) so that I can collaborate with teammates regardless of their network setup.

**Why this priority**: Connection failures due to NAT traversal issues prevent users from using the voice feature at all. This is a blocking issue for many network configurations.

**Independent Test**: Can be tested by attempting connections from various network configurations (symmetric NAT, corporate firewalls, VPNs). Delivers broader feature accessibility.

**Acceptance Scenarios**:

1. **Given** two users behind symmetric NAT, **When** they attempt a voice call, **Then** the call connects via TURN relay within 10 seconds
2. **Given** ICE candidates being gathered, **When** multiple STUN/TURN servers are available, **Then** the fastest candidate is selected and used
3. **Given** a WebRTC connection attempt times out, **When** the failure occurs, **Then** the user receives a clear error message suggesting network troubleshooting steps
4. **Given** ICE connection state changes, **When** the connection fails mid-call, **Then** automatic reconnection is attempted before ending the call

---

### User Story 5 - Real-time Socket Event Handling (Priority: P2)

As a developer, I need to ensure WebSocket event handling is efficient and race-condition-free so that voice call signaling works reliably without dropped signals or out-of-order processing.

**Why this priority**: Race conditions in signaling cause connection failures and require users to retry calls, degrading user experience.

**Independent Test**: Can be tested by simulating high-frequency signal events and verifying correct ordering and processing. Delivers improved connection reliability.

**Acceptance Scenarios**:

1. **Given** WebRTC signals arriving before peer connection is created, **When** signals are buffered, **Then** they are processed in order when the peer connection becomes available
2. **Given** rapid call state transitions (invite → accept → signal), **When** events arrive in quick succession, **Then** all events are processed without race conditions
3. **Given** a socket disconnection during active call, **When** the socket reconnects, **Then** the call state is synchronized and resumed if possible

---

### User Story 6 - Spatial Audio Performance (Priority: P3)

As a user in the virtual office, I need spatial audio to work smoothly without audio glitches or high CPU usage so that the immersive office experience feels natural.

**Why this priority**: Spatial audio enhances the virtual office experience but is secondary to basic call functionality working correctly.

**Independent Test**: Can be tested by moving players rapidly while in a call and monitoring audio smoothness and CPU usage.

**Acceptance Scenarios**:

1. **Given** spatial audio is enabled during a call, **When** a user moves rapidly across the office, **Then** audio volume and pan adjust smoothly without glitches or pops
2. **Given** multiple concurrent calls with spatial audio, **When** all users are moving, **Then** audio processing CPU usage stays below 10%
3. **Given** Web Audio API nodes (GainNode, StereoPannerNode), **When** being updated for spatial positioning, **Then** updates use `setValueAtTime` for smooth transitions

### Edge Cases

- **Microphone unplugged mid-call**: System shows error notification, maintains connection for listening, and prompts user to reconnect microphone
- **Microphone permissions revoked mid-call**: System shows error notification, maintains connection for listening, and prompts user to re-grant permissions
- **Simultaneous call end by both users**: Both end requests succeed idempotently; server processes first received, ignores duplicate; both clients transition to 'ended' state
- **TURN/STUN servers unavailable (all ICE candidates fail)**: Show specific error with troubleshooting steps (firewall check, network switch suggestion) and retry button
- **Browser tab backgrounded during call**: Keep call active using Web Workers/audio keepalive, accept degraded quality while backgrounded
- **WebSocket disconnection during ICE negotiation**: Buffer pending ICE candidates locally; on reconnect, emit voice:rejoin-call with buffered state; if reconnect fails within 30s, show error with retry option
- **AudioContext suspended due to autoplay policy**: Detect suspended state, show "Click to enable audio" prompt; resume AudioContext on user gesture; queue audio operations until resumed
- **Docker file watching with rapid saves**: File watching (Chokidar/Watchpack polling) triggers excessive rebuild events; investigate inotify limits and polling interval optimization

## Requirements *(mandatory)*

### Functional Requirements

#### Voice Call Performance

- **FR-001**: System MUST complete WebRTC connection establishment (ICE gathering + connection) within 10 seconds maximum on standard networks (see SC-001 for 95th percentile target of 5 seconds)
- **FR-002**: System MUST maintain audio quality with less than 200ms end-to-end latency under normal network conditions
- **FR-003**: System MUST properly cleanup all peer connections, audio elements, and AudioContext nodes when calls end
- **FR-004**: System MUST implement automatic reconnection when WebRTC connection drops but socket remains connected, with 30-second timeout showing user-visible countdown, then prompt to retry or end
- **FR-005**: System MUST properly buffer early-arriving WebRTC signals and process them when peer connection is ready
- **FR-006**: System MUST clear buffered signals after 30 seconds to prevent memory accumulation
- **FR-007**: System MUST track call quality metrics (packet loss, jitter, RTT) and expose them for monitoring
- **FR-008**: System MUST support graceful degradation when network quality deteriorates (reduce bitrate, increase buffer)

#### Memory & Resource Management

- **FR-009**: System MUST remove all DOM audio elements created for voice calls when calls end
- **FR-010**: System MUST disconnect and cleanup all Web Audio API nodes when calls end
- **FR-011**: System MUST stop all MediaStream tracks when calls end or component unmounts
- **FR-012**: System MUST properly close AudioContext when user leaves the office
- **FR-013**: System MUST cleanup orphaned audio elements on component unmount
- **FR-014**: System MUST clear all setInterval/setTimeout timers when calls end

#### Docker Environment

- **FR-015**: Docker development environment MUST support Hot Module Replacement with less than 3-second response time
- **FR-016**: Docker volume mounts MUST use efficient file watching that doesn't cause excessive CPU usage
- **FR-017**: Docker containers MUST have appropriate memory limits to prevent resource exhaustion
- **FR-018**: Docker environment MUST NOT cause unexpected browser auto-refreshes during idle periods
- **FR-019**: Docker network configuration MUST support WebSocket connections without timeouts
- **FR-020**: Docker environment MUST properly handle file change events from host system

#### WebSocket & Signaling

- **FR-021**: WebSocket gateway MUST properly forward all voice signaling events (invite, accept, decline, signal, end)
- **FR-022**: Server MUST track active calls and cleanup stale calls when participants disconnect
- **FR-023**: Server MUST notify remaining participants when a peer disconnects unexpectedly
- **FR-024**: Client MUST handle socket reconnection and attempt to rejoin active calls
- **FR-025**: System MUST prevent duplicate call invitations when one is already pending

### Key Entities

- **PeerConnection**: Represents a WebRTC peer connection with associated stream, audio element, and audio processing nodes. Contains peerId, peerName, peer instance, MediaStream, AudioElement, GainNode, StereoPannerNode, and statsInterval.

- **CallState**: Represents the current state of a voice call. States include: idle, calling, ringing, connecting, connected, ended, failed, declined.

- **ActiveCall**: Server-side tracking of active calls. Maps workspaceId to a Set of participant userIds for cleanup on disconnect.

- **SignalBuffer**: Temporary storage for WebRTC signals that arrive before peer connection is created. Includes timeout for automatic cleanup.

- **CallQualityStats**: Metrics collected from RTCPeerConnection including packetsLost, packetsReceived, jitter, roundTripTime, bytesReceived.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Voice calls connect successfully in under 5 seconds for 95% of connection attempts on standard networks
- **SC-002**: Voice calls maintain less than 200ms audio latency for 90% of call duration on stable connections
- **SC-003**: No memory leaks detected: browser memory returns to within 20% of baseline after ending 10 consecutive calls
- **SC-004**: Docker HMR response time is under 3 seconds for 95% of file changes
- **SC-005**: No unexpected browser auto-refreshes occur during 4+ hours of Docker development session
- **SC-006**: System supports 10 concurrent voice calls per workspace without quality degradation
- **SC-007**: Call reconnection succeeds within 10 seconds for 80% of temporary disconnections
- **SC-008**: WebRTC connection success rate exceeds 90% across various NAT configurations when TURN is available
- **SC-009**: CPU usage during voice calls stays below 15% on average client hardware
- **SC-010**: Server memory for WebSocket gateway stays stable (no growth) during extended operation with active calls

## Assumptions

1. Users have modern browsers (Chrome 90+, Firefox 88+, Safari 14+) that fully support WebRTC
2. At least one reliable TURN server is configured for NAT traversal (openrelay.metered.ca is used as fallback)
3. Users have granted microphone permissions before starting calls
4. Docker Desktop or equivalent is properly installed with sufficient allocated resources (8GB+ RAM, 4+ CPU cores)
5. The host machine running Docker has sufficient disk I/O performance for file watching
6. Network latency between Docker containers is negligible (same host)
7. Users are on networks that don't block WebRTC or WebSocket protocols entirely
8. The server has sufficient memory to track active calls (estimated 1KB per active call)

## Clarifications

### Session 2026-02-02

- Q: What should happen when a critical failure occurs mid-call (microphone unplugged, permissions revoked)? → A: Show error notification + maintain connection for listening + prompt user to reconnect mic
- Q: What should happen when WebRTC connection completely fails after exhausting all ICE candidates? → A: Show specific error with troubleshooting steps (firewall check, network switch suggestion) + retry button
- Q: What is the primary suspected cause of the Docker auto-refresh issue? → A: File watching (Chokidar/Watchpack polling) triggering excessive rebuild events
- Q: How long should the system attempt automatic reconnection before declaring the call ended? → A: 30 seconds with user-visible countdown, then prompt to retry or end
- Q: What should happen when the browser tab is backgrounded during a voice call? → A: Keep call active (Web Workers/audio keepalive), accept degraded quality while backgrounded

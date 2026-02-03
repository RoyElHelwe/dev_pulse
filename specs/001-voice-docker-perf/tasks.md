# Tasks: Voice Call & Docker Performance Analysis

**Input**: Design documents from `/specs/001-voice-docker-perf/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests are NOT included by default (not explicitly requested). Add test tasks if TDD approach is desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [x] T001 Create TypeScript interfaces for enhanced PeerConnection, CallState, and ReconnectionState in apps/web/lib/hooks/types/voice-call.types.ts
- [x] T002 [P] Create CallQualityStats interface with quality score calculation in apps/web/lib/hooks/types/voice-call.types.ts
- [x] T003 [P] Add Redis client dependency check to apps/api-gateway/package.json (if not present)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Configure webpack watch options in apps/web/next.config.ts with poll: 300, aggregateTimeout: 200, and ignored patterns (node_modules, .git, .next)
- [ ] T005 [P] Update Docker environment variables in docker-compose.yml (CHOKIDAR_INTERVAL=300, WATCHPACK_POLL_INTERVAL=300, ignored patterns)
- [ ] T006 [P] Add Redis service to docker-compose.yml if not already present for session/cache
- [ ] T007 Create utility function for quality score calculation in apps/web/lib/utils/call-quality.ts
- [ ] T007a [P] Verify WebSocket proxy timeout settings (>60s) in docker/nginx/conf.d/ to prevent connection drops (FR-019)

- [x] T004 Configure webpack watch options in apps/web/next.config.ts with poll: 300, aggregateTimeout: 200, and ignored patterns (node_modules, .git, .next)
- [x] T005 [P] Update Docker environment variables in docker-compose.yml (CHOKIDAR_INTERVAL=300, WATCHPACK_POLL_INTERVAL=300, ignored patterns)
- [x] T006 [P] Add Redis service to docker-compose.yml if not already present for session/cache
- [x] T007 Create utility function for quality score calculation in apps/web/lib/utils/call-quality.ts
- [x] T007a [P] Verify WebSocket proxy timeout settings (>60s) in docker/nginx/conf.d/ to prevent connection drops (FR-019)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Voice Call Performance Audit (Priority: P1) 🎯 MVP

**Goal**: Optimize call connection time, audio latency, and enable quality monitoring

**Independent Test**: Conduct voice calls and measure: connection time <5s, latency <200ms, stats monitoring active

### Implementation for User Story 1

- [x] T008 [US1] Add call quality stats collection using RTCPeerConnection.getStats() in apps/web/lib/hooks/use-voice-call.ts
- [x] T009 [US1] Create stats interval (5s) to collect and calculate packet loss rate, jitter, RTT in apps/web/lib/hooks/use-voice-call.ts
- [x] T010 [P] [US1] Add quality score indicator state to useVoiceCall hook in apps/web/lib/hooks/use-voice-call.ts
- [x] T011 [US1] Implement graceful degradation: reduce stats polling when tab is backgrounded in apps/web/lib/hooks/use-voice-call.ts
- [x] T012 [US1] Add Page Visibility API listener to adjust monitoring frequency in apps/web/lib/hooks/use-voice-call.ts
- [x] T013 [P] [US1] Display connection quality indicator in apps/web/components/voice/VoiceCallUI.tsx
- [x] T014 [US1] Add voice:quality-report socket event emission in apps/web/lib/hooks/use-voice-call.ts
- [x] T015 [US1] Handle voice:quality-report event in apps/api-gateway/src/websocket/websocket.gateway.ts (log metrics)

**Checkpoint**: Voice calls have visible quality monitoring and metrics collection

---

## Phase 4: User Story 2 - Memory Leak & Resource Cleanup (Priority: P1) 🎯 MVP

**Goal**: Eliminate all memory leaks identified in research.md

**Independent Test**: Make 10 calls, end all, verify memory returns to within 20% of baseline in Chrome DevTools

### Implementation for User Story 2

- [x] T016 [US2] Implement explicit cleanup order in cleanupPeer function: timers → tracks → nodes → DOM → peer in apps/web/lib/hooks/use-voice-call.ts
- [x] T017 [US2] Add sourceNode tracking to PeerConnection interface and disconnect on cleanup in apps/web/lib/hooks/use-voice-call.ts
- [x] T018 [US2] Ensure all MediaStream tracks are stopped on call end and component unmount in apps/web/lib/hooks/use-voice-call.ts
- [x] T019 [US2] Fix audio element cleanup: pause, set srcObject=null, remove from DOM in apps/web/lib/hooks/use-voice-call.ts
- [x] T020 [US2] Add proper cleanup for Web Audio nodes (gainNode, pannerNode) with try-catch in apps/web/lib/hooks/use-voice-call.ts
- [x] T021 [US2] Clear signal buffer timeouts on connection established or 30s timeout in apps/web/lib/hooks/use-voice-call.ts
- [x] T022 [US2] Limit signal buffer to 50 signals per peer to prevent memory growth in apps/web/lib/hooks/use-voice-call.ts
- [x] T023 [US2] Add cleanup for orphaned audio elements in useEffect cleanup function in apps/web/lib/hooks/use-voice-call.ts
- [x] T024 [US2] Implement AudioContext close when user leaves office in apps/web/lib/hooks/use-voice-call.ts
- [x] T025 [US2] Add peer.removeAllListeners() before peer.destroy() in cleanup in apps/web/lib/hooks/use-voice-call.ts

**Checkpoint**: Memory stable after 10 consecutive calls, no retained DOM elements or SimplePeer instances

---

## Phase 5: User Story 3 - Docker Development Environment Performance (Priority: P1) 🎯 MVP

**Goal**: Fix slow HMR and auto-refresh issues in Docker development

**Independent Test**: Save file changes and verify HMR <3 seconds, no auto-refresh during 4hr session

### Implementation for User Story 3

> Note: T004/T005 in Phase 2 handle initial webpack and Docker env config. Tasks below verify and extend.

- [x] T026 [US3] Verify webpack watchOptions applied correctly from T004; test HMR response time in apps/web/next.config.ts
- [x] T027 [US3] Verify Docker env vars from T005 are effective; measure poll CPU usage in docker-compose.yml
- [x] T028 [P] [US3] Verify WebSocket proxy_read_timeout >= 86400s in docker/nginx/conf.d/ for long-lived connections
- [x] T029 [P] [US3] Verify web container memory limit is appropriate (2GB currently) in docker-compose.yml
- [x] T030 [P] [US3] Add .dockerignore entries for node_modules, .next, .git if not present
- [x] T031 [US3] Run 4-hour idle test to confirm no unexpected auto-refreshes occur

**Checkpoint**: HMR responds in <3 seconds, no unexpected page refreshes during development

---

## Phase 6: User Story 4 - WebRTC Connection Reliability (Priority: P2)

**Goal**: Improve connection success rate across NAT configurations and handle ICE failures

**Independent Test**: Connect from symmetric NAT, verify TURN relay works, observe reconnection on disconnect

### Implementation for User Story 4

- [ ] T032 [US4] Add iceState tracking to PeerConnection interface in apps/web/lib/hooks/use-voice-call.ts
- [ ] T033 [US4] Implement ICE connection state monitoring via peer.on('iceStateChange') in apps/web/lib/hooks/use-voice-call.ts
- [ ] T034 [US4] Implement ICE restart on 'disconnected' state using pc.restartIce() in apps/web/lib/hooks/use-voice-call.ts
- [ ] T035 [US4] Add reconnection countdown state (30 seconds) with UI display in apps/web/lib/hooks/use-voice-call.ts
- [ ] T036 [P] [US4] Create ReconnectingOverlay component with countdown timer in apps/web/components/voice/ReconnectingOverlay.tsx
- [ ] T037 [US4] Integrate ReconnectingOverlay into VoiceCallUI in apps/web/components/voice/VoiceCallUI.tsx
- [ ] T038 [US4] Add voice:ice-restart-request socket event emission in apps/web/lib/hooks/use-voice-call.ts
- [ ] T039 [US4] Handle voice:ice-restart-request/response in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T040 [US4] Show specific error message with troubleshooting steps on ICE failure in apps/web/components/voice/VoiceCallUI.tsx
- [ ] T041 [US4] Add retry button for failed connections in apps/web/components/voice/VoiceCallUI.tsx
- [ ] T042 [US4] Track reconnectionAttempts, cap at 3 before prompting full reconnect in apps/web/lib/hooks/use-voice-call.ts

**Checkpoint**: Calls recover from temporary disconnects, clear error messages for permanent failures

---

## Phase 7: User Story 5 - Real-time Socket Event Handling (Priority: P2)

**Goal**: Fix race conditions in signaling and ensure socket reconnection preserves calls

**Independent Test**: Simulate rapid signal events, verify ordering; disconnect/reconnect socket, verify call resumes

### Implementation for User Story 5

- [ ] T043 [US5] Implement ordered signal processing from buffer when peer connection ready in apps/web/lib/hooks/use-voice-call.ts
- [ ] T044 [US5] Add voice:connection-state event emission on state changes in apps/web/lib/hooks/use-voice-call.ts
- [ ] T045 [US5] Handle voice:connection-state in gateway for cleanup decisions in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T046 [US5] Implement Redis-based call tracking with 1-hour TTL in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T047 [US5] Migrate activeCalls Map to Redis sadd/srem operations in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T048 [US5] Enhance voice:rejoin-call handler with currentPeers validation in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T049 [US5] Add voice:rejoin-success with callDuration in response in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T050 [US5] Add voice:rejoin-failed with specific reason codes in apps/api-gateway/src/websocket/websocket.gateway.ts
- [ ] T051 [US5] Handle socket reconnection in client: emit rejoin if in active call in apps/web/lib/hooks/use-voice-call.ts
- [ ] T052 [US5] Enhance voice:call-error with code, recoverable, retryAfter fields in apps/api-gateway/src/websocket/websocket.gateway.ts

**Checkpoint**: No race conditions in signaling, calls survive socket reconnection

---

## Phase 8: User Story 6 - Spatial Audio Performance (Priority: P3)

**Goal**: Smooth spatial audio updates without glitches or excessive CPU usage

**Independent Test**: Move rapidly during call, verify smooth audio pan/volume changes, CPU <10%

### Implementation for User Story 6

- [ ] T053 [US6] Replace setValueAtTime with linearRampToValueAtTime (50ms ramp) for gainNode in apps/web/lib/hooks/use-voice-call.ts
- [ ] T054 [US6] Replace setValueAtTime with linearRampToValueAtTime (50ms ramp) for pannerNode in apps/web/lib/hooks/use-voice-call.ts
- [ ] T055 [US6] Throttle spatial audio position updates to max 10Hz (100ms) in apps/web/lib/hooks/use-voice-call.ts
- [ ] T056 [US6] Add jitter trend tracking (last 5 samples) to CallQualityStats in apps/web/lib/hooks/use-voice-call.ts

**Checkpoint**: Spatial audio smooth during rapid movement, no clicks/pops

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T057 [P] Update apps/web/lib/hooks/use-voice-call.ts with comprehensive JSDoc comments
- [ ] T058 [P] Update docs/VOICE_CALL_IMPLEMENTATION.md with new reconnection and quality features
- [ ] T059 [P] Update docs/DOCKER_VOICE_CALL_SETUP.md with optimized configuration
- [ ] T060 Run quickstart.md verification tests (Memory, HMR, Connection, Reconnection, No Auto-Refresh)
- [ ] T061 Performance validation: measure connection time, latency, memory under load

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - P1 stories (US1, US2, US3) should be prioritized for MVP
  - P2 stories (US4, US5) can follow or run in parallel
  - P3 story (US6) is lowest priority
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational - Benefits from US2 cleanup patterns
- **User Story 5 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 6 (P3)**: Can start after Foundational - Benefits from US1 quality metrics

### Within Each User Story

- Core implementation before integration
- State/interface changes before UI updates
- Hook changes before component changes
- Gateway changes can run in parallel with client changes

### Parallel Opportunities

**Phase 2 (Foundational)**: T004, T005, T006, T007 can run in parallel

**User Stories - All P1 stories can run in parallel**:
- US1 (Performance): T008-T015 mostly sequential, T010/T013 parallel
- US2 (Memory): T016-T025 mostly sequential (cleanup order matters)
- US3 (Docker): T026-T031 mostly parallel (different files)

**Cross-Story Parallelism** (if team capacity allows):
- US1 + US3 are completely independent
- US2 shares file with US1 but different functions
- US4 + US5 can run in parallel after P1 stories
- All documentation tasks (T057-T059) can run in parallel

---

## Parallel Example: P1 Stories (MVP)

```bash
# Worker 1: Voice Call Performance (US1)
T008 → T009 → T010 → T011 → T012 → T014 → T015
              ↓ (parallel)
            T013 (UI component)

# Worker 2: Memory Leaks (US2)  
T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025

# Worker 3: Docker HMR (US3)
T026 → T027
        ↓ (parallel)
T028, T029, T030, T031 (all parallel - different files)
```

---

## Implementation Strategy

### MVP Scope (Recommended)
1. **Phase 1**: Setup (T001-T003) - ~30 minutes
2. **Phase 2**: Foundational (T004-T007) - ~1 hour  
3. **Phase 3**: User Story 1 - Performance (T008-T015) - ~2-3 hours
4. **Phase 4**: User Story 2 - Memory Leaks (T016-T025) - ~2-3 hours
5. **Phase 5**: User Story 3 - Docker (T026-T031) - ~1 hour

**MVP delivers**: Quality monitoring, memory stability, faster Docker HMR

### Post-MVP
6. **Phase 6**: User Story 4 - WebRTC Reliability (T032-T042) - ~3-4 hours
7. **Phase 7**: User Story 5 - Socket Handling (T043-T052) - ~3-4 hours
8. **Phase 8**: User Story 6 - Spatial Audio (T053-T056) - ~1 hour
9. **Phase 9**: Polish (T057-T061) - ~1-2 hours

---

## Task Summary

| Phase | Tasks | Parallel Tasks | Story Coverage |
|-------|-------|----------------|----------------|
| Setup | 3 | 2 | Foundation |
| Foundational | 5 | 4 | Foundation + FR-019 |
| US1 - Performance | 8 | 2 | FR-001 to FR-008 |
| US2 - Memory | 10 | 0 | FR-009 to FR-014 |
| US3 - Docker | 6 | 3 | FR-015 to FR-020 (verify) |
| US4 - WebRTC | 11 | 1 | FR-004, FR-008 |
| US5 - Socket | 10 | 0 | FR-021 to FR-025 |
| US6 - Spatial | 4 | 0 | Spatial audio |
| Polish | 5 | 3 | Documentation |
| **Total** | **62** | **15** | All FRs covered |

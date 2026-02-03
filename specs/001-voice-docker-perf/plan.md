# Implementation Plan: Voice Call & Docker Performance Analysis

**Branch**: `001-voice-docker-perf` | **Date**: 2026-02-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-voice-docker-perf/spec.md`

## Summary

Performance audit and optimization of the voice call feature (WebRTC/simple-peer) and Docker development environment. Focus areas: memory leak elimination in useVoiceCall hook, WebRTC connection reliability improvements, Docker file watching optimization for faster HMR, and WebSocket gateway stability enhancements.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22.x  
**Primary Dependencies**: Next.js 14, NestJS 11, simple-peer, socket.io, Web Audio API  
**Storage**: PostgreSQL 16, Redis 7 (for session/cache)  
**Testing**: Jest 29, manual browser testing for WebRTC  
**Target Platform**: Linux Docker containers (dev), modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
**Project Type**: Web monorepo (turborepo with apps/web frontend, apps/api-gateway backend, services/*)  
**Performance Goals**: <5s call connection, <200ms audio latency, <3s HMR response  
**Constraints**: Memory stable after 10 calls, no auto-refresh during 4hr sessions, <15% CPU during calls  
**Scale/Scope**: 10 concurrent calls per workspace, development team of 1-3 developers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is template-only (no project-specific rules defined). Proceeding with standard best practices:
- [x] Changes are scoped to existing modules (no new services)
- [x] Testing approach defined (Jest unit + manual integration)
- [x] No breaking changes to existing APIs
- [x] Performance targets are measurable

## Project Structure

### Documentation (this feature)

```text
specs/001-voice-docker-perf/
├── plan.md              # This file
├── research.md          # Phase 0: Technical research findings
├── data-model.md        # Phase 1: Entity/state model updates
├── quickstart.md        # Phase 1: Quick verification guide
├── contracts/           # Phase 1: API contract updates (if any)
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (affected files)

```text
apps/
├── web/
│   ├── lib/hooks/
│   │   └── use-voice-call.ts       # PRIMARY: Memory leaks, reconnection logic
│   ├── components/voice/
│   │   └── VoiceCallUI.tsx         # Error state UI, reconnection countdown
│   └── app/(dashboard)/office/     # Office integration
├── api-gateway/
│   └── src/websocket/
│       └── websocket.gateway.ts    # Voice signaling, stale call cleanup

docker/
├── docker-compose.yml              # File watching config, memory limits
└── Dockerfile                      # Build optimization

tests/
├── apps/web/__tests__/
│   └── use-voice-call.test.ts      # NEW: Hook unit tests
└── apps/api-gateway/__tests__/
    └── websocket.gateway.test.ts   # NEW: Signaling tests
```

**Structure Decision**: Existing monorepo structure preserved. Changes are optimizations within existing modules, no new packages or services needed.

## Complexity Tracking

> No constitution violations. Standard optimization work within existing architecture.

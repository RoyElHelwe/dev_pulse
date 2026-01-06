# 🚀 ft_transcendence — Real-Time Architecture & Deployment Guide

> **Complete deployment architecture for real-time collaborative workspace with multiplayer game, notifications, whiteboard, Kanban, and voice calls**

---

## Table of Contents

1.  [Executive Summary](#executive-summary)
2.  [System Architecture Overview](#system-architecture-overview)
3.  [Service Architecture](#service-architecture)
4.  [Real-Time Features Design](#real-time-features-design)
5.  [Communication Patterns](#communication-patterns)
6.  [Phase 1: Minimum Viable (Free-Tier Friendly)](#phase-1-minimum-viable-free-tier-friendly)
7.  [Phase 2: Scaling & Real-Time Optimization](#phase-2-scaling--real-time-optimization)
8.  [Phase 3: Production Hardening](#phase-3-production-hardening)
9.  [Cost Analysis & Trade-offs](#cost-analysis--trade-offs)
10.  [Deployment Strategy](#deployment-strategy)
11.  [Monitoring & Operations](#monitoring--operations)

---

## Executive Summary

### Current System

**ft_transcendence** is a collaborative workspace platform with a 2D virtual office, authentication, and workspace management deployed on Google Cloud Run.

### Evolution Strategy

This architecture extends the existing system by adding **5 major real-time features** using only **4 services** (reduced from 5 by removing NATS):

Feature

Implementation

Service

Priority

**2D Multiplayer Game**

WebSocket + Redis (Phase 2+)

api-gateway

Phase 1

**Real-time Notifications**

WebSocket (direct broadcast)

api-gateway

Phase 1

**Collaborative Whiteboard**

WebSocket + Redis

api-gateway + workspace-service

Phase 2

**Task Management (Kanban)**

HTTP + WebSocket

api-gateway (owns data)

Phase 1

**Voice Calls**

WebRTC signaling

api-gateway

Phase 3

### Service Count: 4 (Reduced from 5)

Service

Role

Data Owned (Single Owner)

**web**

Frontend

None (stateless)

**api-gateway**

Main Backend + WebSocket Hub

Task, Sprint, Message, AuditLog

**auth-service**

Authentication (Better Auth)

User, Session, Account, VerificationToken, PasswordReset

**workspace-service**

Workspace Management

Workspace, WorkspaceMember, Invitation

> **⚠️ Single-Owner Data Model**: Each data model has exactly ONE authoritative service:
> 
> -   **User/Session**: auth-service is the ONLY owner. api-gateway validates tokens via HTTP calls to auth-service.
> -   **Workspace**: workspace-service is the ONLY owner. api-gateway proxies workspace requests.
> -   **Tasks/Messages**: api-gateway owns these directly (no proxy needed).
> 
> This eliminates data sync issues and conflicting schemas.

### Cost Target

-   **Phase 1**: $21-39/month (no Redis, single api-gateway instance)
-   **Phase 2**: $77-99/month (add Redis for multi-instance scaling)
-   **Phase 3**: $88-120/month (production ready within free credit)

### Design Principles

1.  **Minimal Services**: Extend existing services, don't add new ones
2.  **Cloud Run Native**: All services run on Cloud Run (no GKE, no always-on VMs)
3.  **Scale to Zero**: Most services scale to zero when idle
4.  **Direct HTTP**: Services communicate via HTTP calls (no message broker needed in Phase 1)

---

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐│                                 INTERNET                                       │└────────────────────────────────┬───────────────────────────────────────────────┘                                 │                    ┌────────────┴────────────┐                    │                         │                    ▼                         ▼        ┌──────────────────────┐   ┌──────────────────────────┐        │   CLOUD RUN: WEB     │   │  CLOUD RUN: API-GATEWAY  │        │   Next.js 16 +       │   │  REST + WebSocket Hub    │        │   Phaser.js          │◄──┤  Game + Voice + Notif    │        │   Scale: 0-10        │   │  Scale: 1 (Phase 1)      │        │   Memory: 512Mi      │   │  Memory: 1Gi             │        └──────────────────────┘   └────────────┬─────────────┘                                                 │                    ┌────────────────────────────┼────────────────────────────┐                    │                            │                            │                    ▼                            ▼                            ▼        ┌──────────────────────┐   ┌──────────────────────┐        │ CLOUD RUN: AUTH-SVC  │   │ CLOUD RUN: WORKSPACE │        │ Auth + 2FA + OAuth   │   │ Workspace + Invites  │        │ HTTP Only            │   │ HTTP Only            │        │ Scale: 0-2           │   │ Scale: 0-2           │        │ Memory: 512Mi        │   │ Memory: 512Mi        │        └──────────┬───────────┘   └──────────┬───────────┘                   │                          │                   └──────────────────────────┼──────────────────────────────┘                                              │                    ┌─────────────────────────┼─────────────────────────┐                    │                         │                         │                    ▼                         ▼                         ▼        ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐        │   VPC CONNECTOR      │   │   SECRET MANAGER     │   │   CLOUD STORAGE      │        │  Private Networking  │   │   Credentials        │   │   Whiteboard Assets  │        └──────────┬───────────┘   └──────────────────────┘   └──────────────────────┘                   │        ┌──────────┴─────────────────────────────────────────────┐        │                                                         │        ▼                                                        ▼┌──────────────────┐                                 ┌──────────────────┐│   CLOUD SQL      │                                 │      REDIS       ││   PostgreSQL 16  │                                 │   Memorystore    ││   3 Databases    │                                 │   (Phase 2+)     ││   Scale: Fixed   │                                 │   WebSocket Pub  │└──────────────────┘                                 └──────────────────┘
```

### Why 4 Services (Not 8)?

Concern

8-Service Approach

4-Service Approach (Chosen)

Concern

8-Service Approach

4-Service Approach (Chosen)

**Complexity**

High (more deployments, more networking)

Low (extend existing services)

**Cost**

~$150-200/month base

~$21-39/month (Phase 1)

**Cold starts**

More services = more cold starts

Fewer services, faster

**Debugging**

Distributed tracing needed

Simpler logs

**Team size**

Good for 5+ developers

Perfect for 1-3 developers

**Scaling**

Independent scaling per feature

Shared scaling (sufficient for <500 users)

### Key Architectural Decisions

Decision

Rationale

Trade-off

**Single WebSocket Hub** (api-gateway)

Cost-efficient, simpler architecture

All real-time in one place

**No NATS in Phase 1**

Cloud Run HTTP-only, direct calls simpler

Add Pub/Sub in Phase 2 if needed

**Extend workspace-service**

Reuse existing database, Prisma setup

Larger service, but simpler overall

**No notification-service**

api-gateway broadcasts directly

Less separation, but fewer moving parts

**No realtime-service**

api-gateway handles game relay

Relay logic in gateway (acceptable for <100 concurrent)

**Redis Phase 2+**

Required for multi-instance WS

$35/month fixed cost (deferred)

---

## Service Architecture

### Service Responsibilities (4 Services Total)

#### 1. **web** (Frontend - Stateless)

**Port**: 3000 | **Tech**: Next.js 16 + Phaser.js | **Scale**: 0-10

**Responsibilities:**

-   Server-side rendering
-   2D game client (Phaser.js)
-   Kanban board UI
-   Whiteboard canvas UI
-   Voice call UI
-   User dashboard

**Communication:**

-   → `api-gateway`: HTTP REST APIs
-   → `api-gateway`: WebSocket (Socket.io client)

**State:** Stateless (scales to zero)

---

#### 2. **api-gateway** (Main Backend + WebSocket Hub - Stateful)

**Port**: 4000 | **Tech**: NestJS + Socket.io + Prisma | **Scale**: 1-5 (Always-On)

**Responsibilities:**

-   REST API for all application features
-   **Data ownership**: Task, Sprint, Message, AuditLog
-   **WebSocket hub** for ALL real-time features:
    -   2D game movement sync
    -   Real-time notifications
    -   Task updates (Kanban)
    -   Chat messages
    -   Whiteboard strokes (Phase 2)
    -   Voice call signaling (WebRTC SDP/ICE, Phase 3)
-   Client-authoritative game state (Phase 1)
-   Session validation (via auth-service)
-   Rate limiting

> **Note**: Despite its name, api-gateway is the main backend service. It owns task-related data models and handles business logic directly. This is intentional for simplicity.

**Communication:**

-   ← `web`: HTTP + WebSocket
-   → `auth-service`: HTTP (token validation)
-   → `workspace-service`: HTTP (workspace queries)
-   ↔ `redis`: WebSocket pub/sub, game state (Phase 2+)
-   ↔ `postgresql`: Application data

**State:** Stateful (min 1 instance, max 1 in Phase 1, session affinity enabled)

---

#### 3. **auth-service** (Authentication - Stateless)

**Port**: 3001 | **Tech**: NestJS + Better Auth | **Scale**: 0-3

**Responsibilities:**

-   User authentication (Better Auth)
-   2FA (TOTP, OTP)
-   OAuth (GitHub, Google)
-   Session management
-   Password reset
-   Email verification

**Communication:**

-   ← `api-gateway`: HTTP (auth checks)
-   → `resend`: Email API (welcome, 2FA codes)
-   ↔ `postgresql`: User data, sessions

**State:** Stateless (scales to zero)

---

#### 4. **workspace-service** (Workspace & Invitations - Stateless)

**Port**: 3002 | **Tech**: NestJS + Prisma | **Scale**: 0-3

**Responsibilities:**

-   Workspace CRUD
-   Member management
-   Invitations & roles
-   Email notifications (Resend)

> **Note**: Task, Sprint, and Message models are owned by api-gateway, not workspace-service. This is by design—api-gateway handles most business logic to reduce inter-service communication.

### Communication

-   ← `api-gateway`: HTTP (workspace queries)
-   ↔ `postgresql`: Workspace, Member, Invitation data
-   → `resend`: Email delivery

**State:** Stateless (scales to zero)

---

## 5. Service Communication (Direct HTTP)

Services communicate via internal Cloud Run URLs using HTTP. No message broker is needed in **Phase 1**.

### Internal Communication Pattern

```typescript
// api-gateway → auth-service (token validation)const response = await fetch(  'https://auth-service-xxx.run.app/internal/validate',  {    method: 'POST',    headers: { Authorization: `Bearer ${token}` }  });// api-gateway → workspace-service (get workspace data)const workspace = await fetch(  `https://workspace-service-xxx.run.app/internal/workspaces/${id}`);
```

---

## Real-Time Features Design

### Feature 1: 2D Multiplayer Game

**Technology Stack:**

-   **Frontend**: Phaser.js 3.x
-   **Backend**: NestJS (relay server, NOT game server)
-   **State Sync**: Client-authoritative with server relay
-   **Protocol**: Socket.io

> **⚠️ Architecture Decision**: Server-authoritative 30 FPS tick rate is incompatible with Cloud Run auto-scaling (state would split across instances). We use **client-authoritative** model instead.

**Architecture:**

```
┌──────────────┐        WebSocket         ┌──────────────────┐│   Phaser.js  │◄─────────────────────────►│  api-gateway     ││   Game Client│     Position updates      │  RELAY SERVER    ││   (Authority)│◄─────────────────────────►│  (No game logic) │└──────────────┘    Broadcast to room      └──────────────────┘        │        ▼  Client validates  own movement
```

**Data Flow (Client-Authoritative):**

1.  Player presses arrow key in Phaser
2.  Client validates move locally (collision detection on client)
3.  Client updates own position and emits `player:position` to server
4.  Server broadcasts position to all players in workspace room (no validation)
5.  Other clients render received positions with interpolation

**Why Client-Authoritative?**

Aspect

Server-Authoritative

Client-Authoritative

Auto-scaling

❌ Breaks state

✅ Works perfectly

Latency

High (round-trip)

Low (immediate)

Cheat prevention

✅ Strong

⚠️ Trust clients

Complexity

High

Low

Cost

High (always-on)

Low (can scale to 0)

> **Acceptable for our use case**: This is a collaborative workspace, not a competitive game. Cheating is not a concern.

**State Management:**

-   **In-Memory (Single Instance)**: Player positions stored in api-gateway memory
-   **No Redis Required for Phase 1**: With `min-instances=1` + `--session-affinity`, all WebSocket connections go to same instance
-   **PostgreSQL (Optional)**: Checkpoint positions for reconnection

**Scalability:**

-   Phase 1: Single instance (`min-instances=1`, `max-instances=1`)
-   Phase 2+: If scaling needed, add Redis for cross-instance pub/sub
-   Rate limit: 20 position updates/second per player (sufficient for smooth movement)

---

### Feature 2: Real-time Notifications

**Technology Stack:**

-   **Push**: WebSocket (Socket.io)
-   **Email**: Resend API
-   **Storage**: PostgreSQL (history)

**Architecture:**

```
┌──────────────┐                          ┌──────────────────┐│ api-gateway  │────Direct Broadcast─────►│   Web Clients    ││ (Task CRUD)  │   notification.created   │   WebSocket      │└──────────────┘                          └──────────────────┘       │       ├────── Optional: Save to history (PostgreSQL)       │       └────── Optional: Send email via Resend API
```

**Notification Types:**

Event

Trigger

Recipients

Channels

Task assigned

Task created/updated

Assignee

WebSocket + Email

Mentioned

Comment/chat

Mentioned users

WebSocket + Email

Invitation

Workspace invite

Invitee

Email only

Sprint started

Sprint status change

Team members

WebSocket only

Call invitation

Voice call initiated

Callees

WebSocket only

Whiteboard shared

Share action

Shared users

WebSocket + Email

**Delivery Guarantees:**

-   WebSocket: Best effort (client must be online)
-   Email: At-least-once (retries on failure)
-   In-app: Persisted to database (survives page refresh)

---

### Feature 3: Collaborative Whiteboard

**Technology Stack:**

-   **Frontend**: Excalidraw (recommended) or tldraw
-   **Backend**: NestJS (relay only)
-   **Sync**: Yjs CRDT (conflict-free)
-   **Persistence**: PostgreSQL (Yjs document snapshots)

> **⚠️ Why Not Custom Canvas + Last-Write-Wins?**
> 
> -   Last-write-wins causes data loss when users draw simultaneously
> -   Building collaborative editing from scratch is a 6+ month project
> -   Excalidraw + Yjs is battle-tested and free

**Recommended: Excalidraw Integration**

```
┌──────────────────┐     WebSocket        ┌──────────────────┐│   Excalidraw     │◄────────────────────►│  api-gateway     ││   (Yjs built-in) │   Yjs sync protocol  │  y-websocket     ││                  │◄────────────────────►│  relay server    │└──────────────────┘                      └────────┬─────────┘                                                   │                                                   ▼                                          ┌──────────────────┐                                          │   PostgreSQL     │                                          │   Yjs snapshots  │                                          │   (BYTEA column) │                                          └──────────────────┘
```

**Implementation (Phase 2):**

```typescript
// Install: pnpm add y-websocket yjs @excalidraw/excalidraw// Backend: y-websocket server in api-gatewayimport { WebsocketProvider } from 'y-websocket';// Frontend: Excalidraw with Yjsimport { Excalidraw } from '@excalidraw/excalidraw';import * as Y from 'yjs';import { WebsocketProvider } from 'y-websocket';const ydoc = new Y.Doc();const provider = new WebsocketProvider(  'wss://api-gateway.run.app',  `whiteboard-${whiteboardId}`,  ydoc);
```

**Data Model:**

```sql
CREATE TABLE whiteboards (  id UUID PRIMARY KEY,  workspace_id UUID NOT NULL,  name VARCHAR(255),  yjs_state BYTEA, -- Yjs document state (binary)  created_by UUID,  created_at TIMESTAMP,  updated_at TIMESTAMP);
```

**Synchronization Strategy:**

-   **Real-time**: Yjs CRDT handles all conflict resolution automatically
-   **No data loss**: CRDTs mathematically guarantee convergence
-   **Persistence**: Snapshot Yjs state to PostgreSQL every 30 seconds
-   **Reconnection**: Load Yjs state from DB, sync catches up automatically

**Scalability:**

-   Unlimited concurrent users (Yjs handles it)
-   Stroke rate: No artificial limit needed (Yjs batches efficiently)
-   Memory: ~1MB per active whiteboard

---

### Feature 4: Task Management (Kanban)

**Technology Stack:**

-   **Frontend**: React + dnd-kit (drag & drop)
-   **Backend**: NestJS + Prisma
-   **Real-time**: WebSocket (optimistic updates)
-   **Storage**: PostgreSQL

**Architecture:**

```
┌──────────────┐                            ┌──────────────────┐│ Kanban Board │──────HTTP POST─────────────►│  api-gateway     ││ Drag Task    │     /tasks/:id/move        │  Update Database ││              │◄───────200 OK──────────────│  (owns Task data)││              │                            └────────┬─────────┘│              │                                     ││              │                                     │ WebSocket│              │                                     ▼│              │                            ┌──────────────────┐│              │◄───WebSocket Broadcast────│  api-gateway     ││              │   task:moved event        │  Broadcast to WS │└──────────────┘                            └──────────────────┘
```

> **Simplified Flow**: api-gateway handles task operations directly. This reduces latency and complexity.

**Data Model:**

```sql
CREATE TABLE tasks (  id UUID PRIMARY KEY,  workspace_id UUID NOT NULL,  title VARCHAR(500) NOT NULL,  description TEXT,  status VARCHAR(50), -- TODO, IN_PROGRESS, REVIEW, DONE  priority VARCHAR(20), -- LOW, MEDIUM, HIGH  assignee_id UUID,  created_by UUID,  due_date TIMESTAMP,  position INTEGER, -- For ordering within column  created_at TIMESTAMP,  updated_at TIMESTAMP);CREATE TABLE task_comments (  id UUID PRIMARY KEY,  task_id UUID,  user_id UUID,  content TEXT,  created_at TIMESTAMP);
```

**Real-Time Updates:**

1.  User drags task from "TODO" to "IN_PROGRESS"
2.  Frontend optimistically updates UI
3.  POST `/tasks/:id/move` to api-gateway
4.  api-gateway updates PostgreSQL directly (api-gateway owns task data)
5.  api-gateway broadcasts `task:moved` via WebSocket to workspace room
6.  Other clients update their Kanban boards

> **Note**: api-gateway owns Task, Sprint, and Message models. workspace-service owns Workspace and Invitation models.

**WebSocket Events:**

-   `task:created`
-   `task:updated`
-   `task:moved` (column change)
-   `task:assigned`
-   `task:comment:added`
-   `task:deleted`

---

### Feature 5: Voice Calls

**Technology Stack:**

-   **Protocol**: WebRTC (peer-to-peer)
-   **Signaling**: Socket.io via api-gateway
-   **TURN/STUN**: Google Cloud TURN servers (or Twilio)
-   **Recording**: Cloud Storage (optional)

**Architecture:**

```
┌──────────────┐                            ┌──────────────────┐│  Web Client  │──────WebSocket SDP────────►│  api-gateway     ││  WebRTC Peer │      Offer/Answer          │  Signaling Hub   ││              │◄──────ICE Candidates───────│  Call State Mgmt │└──────┬───────┘                            └────────┬─────────┘       │                                             │       │                                             ▼       │                                    ┌──────────────────┐       │                                    │   PostgreSQL     │       │                                    │   Call History   │       │                                    └──────────────────┘       │       │                                    ┌──────────────────┐       │  ◄─────────Direct RTP/SRTP────────┤  STUN/TURN       │       │            Media Stream            │  Google Cloud    │       └────────────────────────────────────┤  or Twilio       │                                            └──────────────────┘
```

> **Note**: api-gateway handles signaling directly. There is no separate realtime-service.

**Call Flow:**

1.  **Call Initiation:**
    
    -   User A clicks "Call User B"
    -   Frontend sends `call:invite` to api-gateway
    -   api-gateway emits `call:invitation` to User B
    -   User B receives notification
2.  **Connection Establishment:**
    
    -   User B accepts, sends `call:accept`
    -   User A creates WebRTC offer (SDP)
    -   SDP sent via `call:offer` WebSocket message
    -   User B receives offer, creates answer
    -   Answer sent back via `call:answer`
    -   ICE candidates exchanged via `call:ice-candidate`
3.  **Media Streaming:**
    
    -   Peer-to-peer connection established
    -   Audio/video streams directly between clients
    -   No server media processing (cost-efficient!)
4.  **Call Termination:**
    
    -   Either user sends `call:end`
    -   Peer connection closed
    -   Call state updated in api-gateway (saved to PostgreSQL)

**Data Model:**

```sql
CREATE TABLE calls (  id UUID PRIMARY KEY,  workspace_id UUID,  caller_id UUID,  callee_id UUID,  status VARCHAR(20), -- RINGING, ACTIVE, ENDED, MISSED  started_at TIMESTAMP,  ended_at TIMESTAMP,  duration_seconds INTEGER,  recording_url TEXT -- Cloud Storage URL);
```

**Cost Optimization:**

-   WebRTC = peer-to-peer (no bandwidth cost!)
-   Signaling only (< 1KB per message)
-   TURN servers: ~$0.05/GB (only if direct connection fails)
-   Recording: Optional (disabled by default)

---

## Communication Patterns

### Pattern 1: HTTP REST (Stateless Operations)

**Use Cases:**

-   CRUD operations
-   Authentication
-   Resource queries
-   File uploads

**Services:**

-   auth-service → HTTP only (authentication)
-   workspace-service → HTTP for workspace/invitation CRUD
-   api-gateway → HTTP + WebSocket (main backend, public entry point)

**Example:**

```
POST /api/tasksGET /api/workspaces/:idPUT /api/users/me
```

---

### Pattern 2: WebSocket (Real-Time Push)

**Use Cases:**

-   Live updates
-   Multiplayer sync
-   Notifications
-   Chat messages
-   Cursor positions

**Hub:** api-gateway (Socket.io)

**Events:**

```typescript
// Client → Serversocket.emit('player:move', { x, y })socket.emit('whiteboard:stroke', { points, color })socket.emit('call:offer', { sdp, target })// Server → Clientsocket.on('player:moved', ({ userId, x, y }) => {})socket.on('whiteboard:stroke:added', (stroke) => {})socket.on('notification', (notif) => {})
```

---

### Pattern 3: Direct HTTP (Service-to-Service)

> **Phase 1**: Uses direct HTTP instead of NATS for simplicity.

**Use Cases:**

-   Token validation (api-gateway → auth-service)
-   Workspace queries (api-gateway → workspace-service)
-   Email triggers (api-gateway → workspace-service)

**Example:**

```typescript
// api-gateway → auth-service (token validation)const response = await fetch('http://auth-service/internal/validate', {  method: 'POST',  headers: { 'Authorization': `Bearer ${token}` }});// api-gateway → workspace-service (get workspace)const workspace = await fetch(  `http://workspace-service/internal/workspaces/${id}`);
```

**Cloud Run Internal URLs:**

```
https://auth-service-xxx-uc.a.run.apphttps://workspace-service-xxx-uc.a.run.app
```

> **Phase 2+**: Add Google Cloud Pub/Sub for async events if needed.

---

### Pattern 4: Redis (Phase 2+ Only)

> **Phase 1**: Not required with single api-gateway instance.**Phase 2+**: Required when api-gateway scales to 2+ instances.

**Use Cases (when added):**

-   WebSocket pub/sub across instances
-   Game state synchronization
-   Rate limiting
-   Distributed locks

**Data Structures:**

```
PUBSUB: workspace:{id}:eventsHASH: game:workspace:{id}:playersSTRING: ratelimit:{ip}:{endpoint}
```

---

## Phase 1: Minimum Viable (Free-Tier Friendly)

### Goals

-   Deploy core services (same 5 as current)
-   Enable basic real-time features
-   Stay under $100/month
-   Validate architecture

### Services Deployed (4 Total — No NATS in Phase 1)

Service

Min

Max

Memory

Always-On?

DB Connections

web

0

5

512Mi

No

0

api-gateway

1

1

1Gi

Yes

3

auth-service

0

2

512Mi

No

3 per instance

workspace-service

0

2

512Mi

No

3 per instance

> **Phase 1 Constraint**: api-gateway is limited to `max-instances=1` to avoid Redis requirement. Scale to 3+ in Phase 2 with Redis.

### Features Enabled

-   ✅ 2D multiplayer game (basic movement)
-   ✅ Real-time notifications (WebSocket)
-   ✅ Kanban board (with real-time updates)
-   ❌ Collaborative whiteboard (Phase 2)
-   ❌ Voice calls (Phase 3)

### Infrastructure

**Cloud SQL:**

-   Instance: db-f1-micro ($9/month)
-   Databases: 3 (gateway, auth, workspace)
-   **Max connections**: 25 (db-f1-micro limit)

> **⚠️ Connection Limit Calculation:**
> 
> -   api-gateway: max 3 instances × 3 connections = 9
> -   auth-service: max 2 instances × 3 connections = 6
> -   workspace-service: max 2 instances × 3 connections = 6
> -   **Total**: 21 connections (within 25 limit)
> 
> Use `connection_limit=3` in all DATABASE_URL strings.

**Redis (Phase 1: OPTIONAL):**

-   With `min-instances=1` + `max-instances=1` + `--session-affinity`, Redis is not required
-   Add Redis in Phase 2 when scaling api-gateway beyond 1 instance
-   Cost if added: Memorystore Basic 1GB ($35/month)

**VPC Connector:**

-   e2-micro instances: ~$7/month (min 2 instances)
-   Required for Cloud SQL private IP access

### Cost Breakdown (Phase 1) — Corrected

Item

Cost

Notes

Cloud Run (4 services)

$5-15

No NATS service; most scale to zero

Cloud SQL db-f1-micro

$9

Shared instance, 3 databases

VPC Connector

$7-14

e2-micro min 2 instances (~$0.01/hr each)

Redis Memorystore

$0

**Not needed in Phase 1** (single instance)

Cloud Storage

$0-1

< 1GB

Secret Manager

$0

Free tier (6 secrets)

**Total**

**$21-39**

> **Phase 1 Optimization**: By using single-instance api-gateway with session affinity, we eliminate the $35/month Redis cost. Add Redis in Phase 2 when scaling is needed.

### Deployment Order

1.  **Prerequisites** (Day 1)
    
    -   Enable APIs
    -   Create VPC + Connector
    -   Create Cloud SQL instance (db-f1-micro)
    -   Create secrets (no Redis in Phase 1)
2.  **Core Services** (Day 2)
    
    -   Deploy auth-service
    -   Deploy workspace-service
    -   Run Prisma migrations
3.  **Main Backend** (Day 3)
    
    -   Deploy api-gateway (max-instances=1, WebSocket + REST API)
    -   Configure CORS and session affinity
    -   Test WebSocket connectivity
4.  **Frontend** (Day 4)
    
    -   Deploy web
    -   Test end-to-end

### Validation Checklist

-   User can login
-   User can create workspace
-   User can create task (Kanban)
-   Task updates show real-time
-   2D game loads and shows player
-   Player movement syncs across clients
-   Notifications appear in browser
-   All services scale to zero when idle (except api-gateway min=1)

---

## Phase 2: Scaling & Real-Time Optimization

### Goals

-   Add collaborative whiteboard
-   Optimize WebSocket performance
-   Improve game server
-   Stay under $150/month

### Service Changes

Service

Change

Reason

api-gateway

Scale 1-5, add whiteboard tables

Handle more WebSocket connections, store whiteboard data

### Features Enabled

-   ✅ Collaborative whiteboard (full sync)
-   ✅ Enhanced game server (interactions)
-   ✅ In-app notification history
-   ❌ Voice calls (Phase 3)

### Infrastructure Changes

**Cloud SQL:**

-   Stay on db-f1-micro (sufficient for Phase 2)
-   Add whiteboard tables to api-gateway schema

**Cloud Storage:**

-   Add 5GB for whiteboard snapshots (~$0.10/month)

### Cost Breakdown (Phase 2)

Item

Cost

Delta

Cloud Run

$25-40

+$5-10

Cloud SQL

$9

$0

VPC Connector

$7-14

$0

**Redis (NEW)**

**$35**

**+$35**

Cloud Storage

$1

+$1

**Total**

**$77-99**

**+$41-46**

### Deployment Steps

1.  **Whiteboard Backend** (Week 1)
    
    -   Add whiteboard tables to api-gateway schema
    -   Implement stroke API in api-gateway
    -   Add WebSocket events to api-gateway
2.  **Whiteboard Frontend** (Week 2)
    
    -   Build canvas UI (or integrate Excalidraw)
    -   Implement WebSocket sync
3.  **Game Enhancement** (Week 3)
    
    -   Add interaction zones
    -   Implement proximity detection

### Performance Targets

Metric

Target

WebSocket latency

< 50ms p95

Player position broadcast

< 100ms

Whiteboard stroke lag

< 100ms

Kanban update lag

< 200ms

Concurrent users

100/workspace

---

## Phase 3: Production Hardening

### Goals

-   Add voice calls
-   Production-grade monitoring
-   Security hardening

### New Features

**Voice Calls (WebRTC):**

-   Peer-to-peer audio (no media server!)
-   Signaling via WebSocket (api-gateway)
-   TURN fallback (Twilio or Coturn)

### Infrastructure Changes

**TURN Servers:**

-   Option 1: Twilio (pay-as-you-go, $0.40/GB)
-   Option 2: Coturn on f1-micro (~$5/month)

### Cost Breakdown (Phase 3)

Item

Cost

Delta

Cloud Run

$30-50

+$5-10

Cloud SQL

$9

$0

VPC Connector

$7-14

$0

Redis

$35

$0

TURN Server

$5-10

+$5-10

Cloud Storage

$2

+$1

**Total**

**$88-120**

**+$11-21**

### Deployment Steps

1.  **Voice Call Backend** (Week 1)
    
    -   Add WebRTC signaling to api-gateway
    -   Add call tables to api-gateway schema
    -   Implement SDP/ICE handling
2.  **Voice Call Frontend** (Week 2)
    
    -   Integrate WebRTC client
    -   Build call UI
    -   Test peer-to-peer connectivity
3.  **TURN Setup** (Week 3)
    
    -   Deploy Coturn or configure Twilio
    -   Test NAT traversal
4.  **Monitoring** (Week 4)
    
    -   Create dashboards
    -   Set up alerts

---

## Cost Analysis & Trade-offs

### Monthly Cost Summary

Phase

Cloud Run

Infrastructure

Total

Phase 1

$15-25

$16-23

**$21-39**

Phase 2

$25-40

$52-58

**$77-99**

Phase 3

$30-50

$58-69

**$88-120**

> **Note**: Phase 1 saves ~$35/mo by deferring Redis until Phase 2.

### Why This Is Cheaper Than 8 Services

Aspect

8 Services

4 Services

Savings

Cloud Run base

$15-25/mo

$10-20/mo

~$5/mo

Cold start overhead

High

Low

Faster response

Networking hops

Many

Fewer

Lower latency

Debugging

Complex

Simple

Dev time

Deployment

8 pipelines

4 pipelines

CI/CD cost

### Cost Optimization Strategies

**1. Scale-to-Zero Aggressively:**

-   auth-service: 0-2 instances
-   workspace-service: 0-2 instances
-   Only api-gateway stays warm (min=1)

**2. Keep Database Small:**

-   Stay on db-f1-micro ($9/mo) as long as possible
-   Upgrade only when CPU > 80% sustained

**3. Redis is Phase 2+ Cost:**

-   $35/mo for Memorystore (added in Phase 2)
-   Required when api-gateway scales to 2+ instances
-   No cheaper alternative on GCP

---

## Deployment Strategy

### Prerequisites

**GCP Setup:**

```bash
# Set projectexport PROJECT_ID=ft-transcendence-prodgcloud config set project $PROJECT_ID# Enable APIsgcloud services enable   run.googleapis.com   sqladmin.googleapis.com   redis.googleapis.com   vpcaccess.googleapis.com   pubsub.googleapis.com   secretmanager.googleapis.com   artifactregistry.googleapis.com   cloudbuild.googleapis.com# Create Artifact Registrygcloud artifacts repositories create ft-trans   --repository-format=docker   --location=us-central1
```

**Network Setup:**

```bash
# Create VPCgcloud compute networks create ft-trans-vpc   --subnet-mode=auto# Create VPC Connectorgcloud compute networks vpc-access connectors create ft-trans-connector   --region=us-central1   --network=ft-trans-vpc   --range=10.8.0.0/28   --min-instances=1   --max-instances=3
```

**Database Setup:**

```bash
# Create Cloud SQL instancegcloud sql instances create ft-trans-db   --database-version=POSTGRES_16   --tier=db-f1-micro   --region=us-central1   --network=ft-trans-vpc   --no-assign-ip# Create databasesgcloud sql databases create ft_trans_gateway --instance=ft-trans-dbgcloud sql databases create ft_trans_auth --instance=ft-trans-dbgcloud sql databases create ft_trans_workspace --instance=ft-trans-dbgcloud sql databases create ft_trans_tasks --instance=ft-trans-db# Set passwordgcloud sql users set-password postgres   --instance=ft-trans-db   --password=$(openssl rand -base64 32)
```

**Redis Setup (Phase 2+ Only):**

```bash
# Create Memorystore instance (skip for Phase 1)gcloud redis instances create ft-trans-redis   --size=1   --region=us-central1   --tier=BASIC   --network=ft-trans-vpc
```

**Secrets Setup:**

```bash
# Database URLsecho -n "postgresql://user:pass@/ft_trans_gateway?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-gateway --data-file=-echo -n "postgresql://user:pass@/ft_trans_auth?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-auth --data-file=-echo -n "postgresql://user:pass@/ft_trans_workspace?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-workspace --data-file=-# JWT Secretopenssl rand -base64 64 | gcloud secrets create jwt-secret --data-file=-# Phase 2+: Add Redis URL after creating Memorystore# REDIS_HOST=$(gcloud redis instances describe ft-trans-redis --region=us-central1 --format="value(host)")# echo -n "redis://$REDIS_HOST:6379" | gcloud secrets create redis-url --data-file=-
```

### Service Deployment Commands

**API Gateway (Phase 1: max-instances=1):**

```bash
gcloud run deploy ft-trans-api-gateway   --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:latest   --region=us-central1   --allow-unauthenticated   --vpc-connector=ft-trans-connector   --add-cloudsql-instances=$PROJECT_ID:us-central1:ft-trans-db   --min-instances=1 --max-instances=1   --memory=1Gi --cpu=1   --port=4000   --timeout=3600   --session-affinity   --no-cpu-throttling   --set-env-vars="NODE_ENV=production"   --set-secrets="DATABASE_URL=database-url-gateway:latest,JWT_SECRET=jwt-secret:latest"
```

> **Phase 2+**: Increase `--max-instances=5` and add `REDIS_URL=redis-url:latest` secret.

**Workspace Service:**

```bash
gcloud run deploy ft-trans-workspace-service   --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:latest   --region=us-central1   --vpc-connector=ft-trans-connector   --add-cloudsql-instances=$PROJECT_ID:us-central1:ft-trans-db   --min-instances=0 --max-instances=2   --memory=512Mi --cpu=1   --port=3002   --set-env-vars="NODE_ENV=production"   --set-secrets="DATABASE_URL=database-url-workspace:latest,RESEND_API_KEY=resend-api-key:latest"
```

**Auth Service:**

```bash
gcloud run deploy ft-trans-auth-service   --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/auth-service:latest   --region=us-central1   --vpc-connector=ft-trans-connector   --add-cloudsql-instances=$PROJECT_ID:us-central1:ft-trans-db   --min-instances=0 --max-instances=2   --memory=512Mi --cpu=1   --port=3001   --set-env-vars="NODE_ENV=production"   --set-secrets="DATABASE_URL=database-url-auth:latest,JWT_SECRET=jwt-secret:latest"
```

### CI/CD Pipeline

**cloudbuild.yaml:**

```yaml
steps:  # Build web  - name: 'gcr.io/cloud-builders/docker'    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:$SHORT_SHA', '-f', 'docker/Dockerfile.web', '.']    # Build api-gateway  - name: 'gcr.io/cloud-builders/docker'    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:$SHORT_SHA', '-f', 'docker/Dockerfile.gateway', '.']    # Build auth-service  - name: 'gcr.io/cloud-builders/docker'    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/auth-service:$SHORT_SHA', '-f', 'docker/Dockerfile.auth', '.']    # Build workspace-service  - name: 'gcr.io/cloud-builders/docker'    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:$SHORT_SHA', '-f', 'docker/Dockerfile.workspace', '.']    # Push all images (parallel)  - name: 'gcr.io/cloud-builders/docker'    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/web:$SHORT_SHA']  - name: 'gcr.io/cloud-builders/docker'    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:$SHORT_SHA']  - name: 'gcr.io/cloud-builders/docker'    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/auth-service:$SHORT_SHA']  - name: 'gcr.io/cloud-builders/docker'    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:$SHORT_SHA']    # Deploy to Cloud Run  - name: 'gcr.io/cloud-builders/gcloud'    args: ['run', 'deploy', 'ft-trans-api-gateway', '--image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:$SHORT_SHA', '--region=us-central1']timeout: '1800s'
```

---

## Monitoring & Operations

### Health Checks

**All Services:**

```typescript
@Controller()export class AppController {  @Get('health')  health() {    return { status: 'healthy', timestamp: new Date() }  }  @Get('health/ready')  async ready() {    // Check dependencies    await this.checkDatabase()    // Phase 2+: await this.checkRedis()    return { status: 'ready' }  }}
```

**Cloud Run Configuration:**

```bash
--startup-probe-http-path=/health/ready --liveness-probe-http-path=/health --readiness-probe-http-path=/health/ready
```

### Logging

**Structured Logging:**

```typescript
import { Logger } from '@nestjs/common'const logger = new Logger('WebSocketGateway')logger.log({  message: 'Player moved',  userId: 'user123',  x: 100,  y: 200,  duration_ms: 5})
```

**Log Queries:**

```
# WebSocket errorsresource.type="cloud_run_revision"resource.labels.service_name="ft-trans-api-gateway"severity>=ERROR# Slow queriesresource.type="cloud_run_revision"jsonPayload.duration_ms>1000# Player position broadcastsresource.type="cloud_run_revision"jsonPayload.message="Player moved"
```

### Metrics

**Custom Metrics:**

```typescript
import { Counter, Histogram } from 'prom-client';const wsConnectionsTotal = new Counter({  name: 'websocket_connections_total',  help: 'Total WebSocket connections'});const positionBroadcastDuration = new Histogram({  name: 'position_broadcast_duration_seconds',  help: 'Time to broadcast player position'});
```

### Alerts

**Critical Alerts:**

1.  API Gateway down (5xx > 10%)
2.  Database connections exhausted
3.  Redis memory > 90% (Phase 2+)
4.  WebSocket disconnect rate > 20%

**Warning Alerts:**

1.  Cloud Run cold starts > 10/min
2.  Database CPU > 70%
3.  Player broadcast lag > 100ms
4.  HTTP errors to internal services > 5%

---

## Conclusion

This architecture provides a **production-ready, cost-efficient deployment** for ft_transcendence on Google Cloud Run, extending the existing system with real-time features while staying within the $300 free credit budget.

### Key Achievements

✅ **Cost-Efficient:** $21-120/month across 3 phases  
✅ **Scalable:** Auto-scales from 0 to handle spikes  
✅ **Real-Time:** WebSocket and WebRTC integration  
✅ **Cloud-Native:** 100% Cloud Run, no VMs or GKE  
✅ **Maintainable:** Clear service boundaries, direct HTTP for service communication

### Next Steps

1.  Implement Phase 1 (2-3 weeks)
2.  Validate with users (1 week)
3.  Implement Phase 2 (3-4 weeks)
4.  Production hardening Phase 3 (2-3 weeks)

**Total Timeline:** 8-11 weeks to full production

---

> **Version:** 1.0  
> **Author:** Senior Cloud Architect  
> **Date:** January 2026  
> **Status:** Ready for Implementation
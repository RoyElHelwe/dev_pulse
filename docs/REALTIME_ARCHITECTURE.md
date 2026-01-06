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

This architecture extends the existing system by adding **5 major real-time features** using only **5 services** (no new services added):

Feature

Implementation

Service

Priority

**2D Multiplayer Game**

WebSocket + Redis

api-gateway

Phase 1

**Real-time Notifications**

WebSocket + NATS

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

### Service Count: 5 (Same as Current)

Service

Role

Data Owned

**web**

Frontend

None (stateless)

**api-gateway**

WebSocket Hub + REST API

User, Session, Workspace, Task, Sprint, Message, AuditLog

**auth-service**

Authentication (Better Auth)

User, Session, Account (auth-specific copy)

**workspace-service**

Workspace CRUD + Invitations

Workspace, WorkspaceMember, Invitation

**nats**

Message Broker

None (stateless)

> **Architecture Note**: The api-gateway is not a pure gateway—it owns most application data and handles business logic. This is intentional for a small team (1-3 developers). The auth-service maintains a separate User/Session store for authentication isolation.

### Cost Target

-   **Phase 1**: $80-100/month (free tier + minimal paid usage)
-   **Phase 2**: $100-130/month (scaling optimization)
-   **Phase 3**: $130-180/month (production ready within free credit)

### Design Principles

1.  **Minimal Services**: Extend existing services, don't add new ones
2.  **Cloud Run Native**: All services run on Cloud Run (no GKE, no always-on VMs)
3.  **Scale to Zero**: Most services scale to zero when idle
4.  **Shared Infrastructure**: Reuse Redis, PostgreSQL, NATS across features

---

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐│                                 INTERNET                                       │└────────────────────────────────┬───────────────────────────────────────────────┘                                 │                    ┌────────────┴────────────┐                    │                         │                    ▼                         ▼        ┌──────────────────────┐   ┌──────────────────────────┐        │   CLOUD RUN: WEB     │   │  CLOUD RUN: API-GATEWAY  │        │   Next.js 16 +       │   │  REST + WebSocket Hub    │        │   Phaser.js          │◄──┤  Game + Voice + Notif    │        │   Scale: 0-10        │   │  Scale: 1-5 (Always-On)  │        │   Memory: 512Mi      │   │  Memory: 1Gi             │        └──────────────────────┘   └────────────┬─────────────┘                                                 │                    ┌────────────────────────────┼────────────────────────────┐                    │                            │                            │                    ▼                            ▼                            ▼        ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐        │ CLOUD RUN: AUTH-SVC  │   │ CLOUD RUN: WORKSPACE │   │   CLOUD RUN: NATS    │        │ Auth + 2FA + OAuth   │   │ Workspace + Tasks +  │   │   Message Broker     │        │ HTTP Only            │   │ Whiteboard Storage   │   │   Scale: 1 (Fixed)   │        │ Scale: 0-3           │   │ Scale: 0-3           │   │   Memory: 256Mi      │        │ Memory: 512Mi        │   │ Memory: 512Mi        │   │                      │        └──────────┬───────────┘   └──────────┬───────────┘   └──────────────────────┘                   │                          │                   └──────────────────────────┼──────────────────────────────┘                                              │                    ┌─────────────────────────┼─────────────────────────┐                    │                         │                         │                    ▼                         ▼                         ▼        ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐        │   VPC CONNECTOR      │   │   SECRET MANAGER     │   │   CLOUD STORAGE      │        │  Private Networking  │   │   Credentials        │   │   Whiteboard Assets  │        └──────────┬───────────┘   └──────────────────────┘   └──────────────────────┘                   │        ┌──────────┴─────────────────────────────────────────────┐        │                                                         │        ▼                                                        ▼┌──────────────────┐                                 ┌──────────────────┐│   CLOUD SQL      │                                 │      REDIS       ││   PostgreSQL 16  │                                 │   Memorystore    ││   3 Databases    │                                 │   WebSocket Pub  ││   Scale: Fixed   │                                 │   Game State     │└──────────────────┘                                 └──────────────────┘
```

### Why 5 Services (Not 8)?

Concern

8-Service Approach

5-Service Approach (Chosen)

**Complexity**

High (more deployments, more networking)

Low (extend existing services)

**Cost**

~$150-200/month base

~$80-100/month base

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

**Extend workspace-service**

Reuse existing database, Prisma setup

Larger service, but simpler overall

**No notification-service**

NATS + api-gateway handles it

Less separation, but fewer moving parts

**No realtime-service**

api-gateway handles game loop

Game loop in gateway (acceptable for <100 concurrent)

**Redis for state**

Required for multi-instance WS

~$35/month fixed cost

---

## Service Architecture

### Service Responsibilities (5 Services Total)

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
-   **Data ownership**: User, Workspace, Task, Sprint, Message, AuditLog
-   **WebSocket hub** for ALL real-time features:
    -   2D game movement sync
    -   Real-time notifications
    -   Task updates (Kanban)
    -   Chat messages
    -   Whiteboard strokes (future)
    -   Voice call signaling (WebRTC SDP/ICE, future)
-   Game server loop (30 FPS tick rate)
-   Session validation (via auth-service)
-   Rate limiting

> **Note**: Despite its name, api-gateway is the main backend service. It owns most data models and handles business logic directly. This is intentional for simplicity.

**Communication:**

-   ← `web`: HTTP + WebSocket
-   → `auth-service`: HTTP (token validation)
-   → `workspace-service`: NATS (workspace events)
-   ↔ `redis`: WebSocket pub/sub, game state
-   ↔ `postgresql`: Application data
-   ↔ `nats`: Service communication

**State:** Stateful (min 1 instance, session affinity enabled)

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
-   → `nats`: Email events (welcome, 2FA codes)
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

**Communication:**

-   ← `api-gateway`: HTTP + NATS
-   ↔ `postgresql`: Workspace, Member, Invitation data
-   → `resend`: Email delivery

**State:** Stateless (scales to zero)

---

#### 5. **nats** (Message Broker - Stateful)

**Port**: 4222 | **Tech**: NATS JetStream | **Scale**: 1 (Fixed)

**Responsibilities:**

-   Microservice message queue
-   Event bus between services
-   Request-reply pattern

**State:** Stateful (always running, single instance)

---

## Real-Time Features Design

### Feature 1: 2D Multiplayer Game

**Technology Stack:**

-   **Frontend**: Phaser.js 3.x
-   **Backend**: NestJS game server
-   **State Sync**: Redis + WebSocket
-   **Protocol**: Socket.io

**Architecture:**

```
┌──────────────┐        WebSocket         ┌──────────────────┐│   Phaser.js  │◄─────────────────────────►│  api-gateway     ││   Game Client│     Movement events       │  Game Loop (30fps)││              │◄─────────────────────────►│  State Authority │└──────────────┘    Position updates       └────────┬─────────┘                                                    │                                                    ▼                                           ┌──────────────────┐                                           │      Redis       │                                           │  Player Positions│                                           │  Game Objects    │                                           └──────────────────┘
```

**Data Flow:**

1.  Player presses arrow key in Phaser
2.  Client emits `player:move` to api-gateway via WebSocket
3.  api-gateway validates move, updates Redis
4.  api-gateway broadcasts `player:moved` to all players in workspace room
5.  Phaser interpolates movement on all clients

> **Note**: api-gateway handles the game loop directly. There is no separate realtime-service.

**State Management:**

-   **Redis Keys**:
    -   `game:workspace:{workspaceId}:players` (Hash of player positions)
    -   `game:workspace:{workspaceId}:objects` (Game objects state)
-   **TTL**: 1 hour (auto-cleanup inactive sessions)
-   **Persistence**: Checkpoint to PostgreSQL every 5 minutes (optional)

**Scalability:**

-   Game server loop runs in api-gateway
-   Shared state via Redis (required for multi-instance)
-   Rate limit: 60 move commands/second per player

---

### Feature 2: Real-time Notifications

**Technology Stack:**

-   **Push**: WebSocket (Socket.io)
-   **Queue**: Cloud Pub/Sub
-   **Email**: Resend API
-   **Storage**: PostgreSQL (history)

**Architecture:**

```
┌──────────────┐                          ┌──────────────────┐│ Any Service  │────NATS Event───────────►│  api-gateway     ││ (Task, etc)  │   notification.created   │  Receive Event   │└──────────────┘                          └────────┬─────────┘                                                   │                        ┌──────────────────────────┼──────────────────┐                        │                          │                  │                        ▼                          ▼                  ▼              ┌──────────────────┐      ┌──────────────┐    ┌──────────────┐              │   Web Client     │      │ workspace-   │    │ workspace-   │              │ WebSocket Push   │      │ service      │    │ service      │              │ Toast Notification│      │ Resend Email │    │ Save History │              └──────────────────┘      └──────────────┘    └──────────────┘
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

-   **Frontend**: React + Canvas API (or Excalidraw)
-   **Backend**: NestJS + Redis
-   **Persistence**: PostgreSQL + Cloud Storage
-   **Sync**: Operational Transformation (OT) or CRDT

**Architecture:**

```
┌──────────────┐     WebSocket        ┌──────────────────┐│ Canvas UI    │◄────────────────────►│  api-gateway     ││ Draw Stroke  │   stroke:add event   │  Broadcast Hub   ││ Excalidraw   │◄────────────────────►│  Persist to DB   │└──────────────┘   stroke:added evt   └────────┬─────────┘                                                │                        ┌───────────────────────┼────────────────────┐                        │                       │                    │                        ▼                       ▼                    ▼              ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐              │      Redis       │    │ PostgreSQL   │    │Cloud Storage │              │ Active Strokes   │    │ Whiteboard   │    │ Canvas PNG   │              │ Temp Buffer      │    │ Strokes      │    │ Snapshots    │              └──────────────────┘    └──────────────┘    └──────────────┘
```

> **Note**: api-gateway handles whiteboard operations directly. The whiteboard tables will be added to api-gateway's Prisma schema (Phase 2 feature).

**Data Model:**

**PostgreSQL (persistent):**

```sql
CREATE TABLE whiteboards (  id UUID PRIMARY KEY,  workspace_id UUID NOT NULL,  name VARCHAR(255),  created_by UUID,  created_at TIMESTAMP,  last_modified TIMESTAMP);CREATE TABLE whiteboard_strokes (  id UUID PRIMARY KEY,  whiteboard_id UUID,  user_id UUID,  stroke_data JSONB, -- {type, points, color, width, timestamp}  created_at TIMESTAMP,  INDEX idx_whiteboard_time (whiteboard_id, created_at));
```

**Redis (real-time):**

```
whiteboard:{id}:active_users   SET      [userId1, userId2]whiteboard:{id}:cursor:{user}  STRING   {x, y, timestamp}whiteboard:{id}:lock:{object}  STRING   userId  (TTL: 30s)
```

**Synchronization Strategy:**

-   **Real-time**: All strokes broadcast via WebSocket
-   **Conflict resolution**: Last-write-wins (simple)
-   **Optimization**: Batch strokes every 100ms
-   **Persistence**: Save to PostgreSQL every 5 seconds
-   **Snapshot**: Generate PNG every 1 minute (Cloud Storage)

**Scalability:**

-   50 concurrent users per whiteboard
-   10 whiteboards per workspace
-   Stroke rate limit: 100/second per user

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

> **Simplified Flow**: api-gateway handles task operations directly without NATS roundtrip to workspace-service. This reduces latency and complexity.

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

### Pattern 3: NATS (Async Commands & Events)

**Use Cases:**

-   Service-to-service communication
-   Event broadcasting
-   Request-reply pattern
-   Background jobs

**Message Types:**

-   **Commands**: `{ cmd: 'create_task' }`
-   **Events**: `{ event: 'task.created' }`
-   **Replies**: `{ success: true, data: {...} }`

**Example:**

```typescript
// api-gateway → workspace-service (command)nats.send({ cmd: 'create_task' }, data)// workspace-service → api-gateway (event)nats.publish('task.created', task)// api-gateway → auth-service (request-reply)const user = await nats.request({ cmd: 'get_user' }, { userId })
```

---

### Pattern 4: Redis (Shared State)

**Use Cases:**

-   WebSocket session affinity
-   Game state cache
-   Rate limiting
-   Distributed locks
-   Cursor positions

**Data Structures:**

```
STRING: session:{sessionId}HASH: player:{userId}SET: workspace:{id}:membersZSET: leaderboard:workspace:{id}PUBSUB: workspace:{id}:events
```

---

## Phase 1: Minimum Viable (Free-Tier Friendly)

### Goals

-   Deploy core services (same 5 as current)
-   Enable basic real-time features
-   Stay under $100/month
-   Validate architecture

### Services Deployed (5 Total)

Service

Min

Max

Memory

Always-On?

web

0

5

512Mi

No

api-gateway

1

3

1Gi

Yes (min 1)

auth-service

0

2

512Mi

No

workspace-service

0

2

512Mi

No

nats

1

1

256Mi

Yes (fixed)

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

**Redis:**

-   Memorystore Basic 1GB ($35/month)
-   Purpose: WebSocket adapter + game state

**VPC Connector:**

-   1 min instance ($41/month fixed)

### Cost Breakdown (Phase 1)

Item

Cost

Notes

Cloud Run (5 services)

$10-20

Most scale to zero

Cloud SQL

$9

db-f1-micro

VPC Connector

$41

Fixed cost

Redis Memorystore

$35

1GB Basic tier

Cloud Storage

$0-1

< 1GB

**Total**

**$95-106**

### Deployment Order

1.  **Prerequisites** (Day 1)
    
    -   Enable APIs
    -   Create VPC + Connector
    -   Create Cloud SQL instance
    -   Create Redis instance
    -   Create secrets
2.  **Core Services** (Day 2)
    
    -   Deploy nats
    -   Deploy auth-service
    -   Deploy workspace-service
3.  **Main Backend** (Day 3)
    
    -   Deploy api-gateway (WebSocket + REST API + Task/Sprint tables)
    -   Configure CORS
    -   Test WebSocket connectivity
4.  **Frontend** (Day 4)
    
    -   Deploy web
    -   Test end-to-end

### Validation Checklist

-    User can login
-    User can create workspace
-    User can create task (Kanban)
-    Task updates show real-time
-    2D game loads and shows player
-    Player movement syncs across clients
-    Notifications appear in browser
-    All services scale to zero when idle (except api-gateway, nats)

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

$20-35

+$10-15

Cloud SQL

$9

$0

VPC Connector

$41

$0

Redis

$35

$0

Cloud Storage

$1

+$1

**Total**

**$106-121**

**+$11-15**

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

Game tick rate

30 FPS

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

$25-40

+$5

Cloud SQL

$9

$0

VPC Connector

$41

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

**$117-137**

**+$11-16**

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

Services

Infrastructure

Total

Phase 1

$10-20

$85

**$95-106**

Phase 2

$20-35

$86

**$106-121**

Phase 3

$25-40

$92

**$117-137**

### Why This Is Cheaper Than 8 Services

Aspect

8 Services

5 Services

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

5 pipelines

CI/CD cost

### Cost Optimization Strategies

**1. Scale-to-Zero Aggressively:**

-   auth-service: 0-2 instances
-   workspace-service: 0-2 instances
-   Only api-gateway + nats stay warm

**2. Keep Database Small:**

-   Stay on db-f1-micro ($9/mo) as long as possible
-   Upgrade only when CPU > 80% sustained

**3. Redis is Fixed Cost:**

-   $35/mo for Memorystore
-   Worth it for WebSocket multi-instance support
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

**Redis Setup:**

```bash
# Create Memorystore instancegcloud redis instances create ft-trans-redis   --size=1   --region=us-central1   --tier=BASIC   --network=ft-trans-vpc
```

**Secrets Setup:**

```bash
# Database URLsecho -n "postgresql://user:pass@/ft_trans_gateway?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-gateway --data-file=-echo -n "postgresql://user:pass@/ft_trans_auth?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-auth --data-file=-echo -n "postgresql://user:pass@/ft_trans_workspace?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-workspace --data-file=-echo -n "postgresql://user:pass@/ft_trans_tasks?host=/cloudsql/$PROJECT_ID:us-central1:ft-trans-db"   | gcloud secrets create database-url-tasks --data-file=-# Redis URLREDIS_HOST=$(gcloud redis instances describe ft-trans-redis --region=us-central1 --format="value(host)")echo -n "redis://$REDIS_HOST:6379" | gcloud secrets create redis-url --data-file=-# JWT Secretopenssl rand -base64 64 | gcloud secrets create jwt-secret --data-file=-# NATS Tokenopenssl rand -base64 32 | gcloud secrets create nats-token --data-file=-
```

### Service Deployment Commands

**NATS:**

```bash
gcloud run deploy ft-trans-nats   --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/nats:latest   --region=us-central1   --allow-unauthenticated   --min-instances=1 --max-instances=1   --memory=256Mi --cpu=0.5   --port=4222   --set-secrets="NATS_TOKEN=nats-token:latest"
```

**API Gateway:**

```bash
gcloud run deploy ft-trans-api-gateway   --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/api-gateway:latest   --region=us-central1   --allow-unauthenticated   --vpc-connector=ft-trans-connector   --add-cloudsql-instances=$PROJECT_ID:us-central1:ft-trans-db   --min-instances=1 --max-instances=5   --memory=1Gi --cpu=1   --port=4000   --timeout=3600   --session-affinity   --no-cpu-throttling   --set-env-vars="NODE_ENV=production,NATS_URL=nats://ft-trans-nats:4222"   --set-secrets="DATABASE_URL=database-url-gateway:latest,REDIS_URL=redis-url:latest,JWT_SECRET=jwt-secret:latest,NATS_TOKEN=nats-token:latest"
```

**Workspace Service:**

```bash
gcloud run deploy ft-trans-workspace-service   --image=us-central1-docker.pkg.dev/$PROJECT_ID/ft-trans/workspace-service:latest   --region=us-central1   --vpc-connector=ft-trans-connector   --add-cloudsql-instances=$PROJECT_ID:us-central1:ft-trans-db   --min-instances=0 --max-instances=3   --memory=512Mi --cpu=1   --port=3002   --set-env-vars="NODE_ENV=production,NATS_URL=nats://ft-trans-nats:4222"   --set-secrets="DATABASE_URL=database-url-workspace:latest,NATS_TOKEN=nats-token:latest,RESEND_API_KEY=resend-api-key:latest"
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
@Controller()export class AppController {  @Get('health')  health() {    return { status: 'healthy', timestamp: new Date() }  }  @Get('health/ready')  async ready() {    // Check dependencies    await this.checkDatabase()    await this.checkRedis()    return { status: 'ready' }  }}
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
# WebSocket errorsresource.type="cloud_run_revision"resource.labels.service_name="ft-trans-api-gateway"severity>=ERROR# Slow queriesresource.type="cloud_run_revision"jsonPayload.duration_ms>1000# Game server tick rateresource.type="cloud_run_revision"jsonPayload.game_tick_duration_ms>33
```

### Metrics

**Custom Metrics:**

```typescript
import { Counter, Histogram } from 'prom-client'const wsConnectionsTotal = new Counter({  name: 'websocket_connections_total',  help: 'Total WebSocket connections'})const gameTickDuration = new Histogram({  name: 'game_tick_duration_seconds',  help: 'Game server tick duration'})
```

### Alerts

**Critical Alerts:**

1.  API Gateway down (5xx > 10%)
2.  Database connections exhausted
3.  Redis memory > 90%
4.  WebSocket disconnect rate > 20%

**Warning Alerts:**

1.  Cloud Run cold starts > 10/min
2.  Database CPU > 70%
3.  Game tick lag > 50ms
4.  NATS message queue > 1000

---

## Conclusion

This architecture provides a **production-ready, cost-efficient deployment** for ft_transcendence on Google Cloud Run, extending the existing system with 5 major real-time features while staying within the $300 free credit budget.

### Key Achievements

✅ **Cost-Efficient:** $100-220/month across 3 phases  
✅ **Scalable:** Auto-scales from 0 to handle spikes  
✅ **Real-Time:** WebSocket, WebRTC, and Pub/Sub integration  
✅ **Cloud-Native:** 100% Cloud Run, no VMs or GKE  
✅ **Maintainable:** Clear service boundaries, NATS for async

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
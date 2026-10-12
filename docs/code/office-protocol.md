# Office socket protocol

## Purpose

The office WebSocket protocol enables real-time multiplayer spatial interactions within DevPulse's 2D virtual workspace. It synchronizes avatar movements, facing directions, seated chair states, zone boundaries, peer-to-peer WebRTC audio signalling, ephemeral and room-partitioned text chat, meeting room booking locks, live task board updates, single-browser tab session takeover, and session revocation.

All primary office interactions run over the `/office` Socket.IO namespace using direct WebSocket transport (`transports: ['websocket']`) to eliminate HTTP polling latency. Secondary namespaces include `/session` for global account session revocation and the root `/` namespace for health diagnostics.

---

## Where it lives

### API (`apps/api/src/`)

| File | One-line job |
| --- | --- |
| `common/auth/socket-auth.ts` | Authenticates Socket.IO handshakes via JWT tokens extracted from handshake auth payloads or cookie headers. |
| `office/office.gateway.ts` | Root office WebSocket gateway on `/office` managing member connection lifecycles, tab concurrency, spatial movement, zone changes, and room broadcasts. |
| `office/office.rules.ts` | Spatial boundaries, walking speed validation (`limitMove`), token bucket rate limiting (`Budget`), and single-tab claiming rules (`claimOffice`). |
| `voice/voice.gateway.ts` | WebRTC signalling gateway on `/office` routing peer-to-peer audio offers/answers/candidates and synchronizing mic mute/deafen states. |
| `voice/voice.rules.ts` | Proximity earshot calculations (`withinEarshot`) and meeting room booking access checks (`bookingAllows`). |
| `chat/chat.gateway.ts` | Text chat gateway on `/office` receiving incoming messages (`chat:send`) with handshake auth delegation. |
| `chat/chat.service.ts` | Chat message persistence, rate limiting (1 msg/s), meeting privacy boundary filtering, and channel broadcast dispatch. |
| `chat/chat.rules.ts` | Channel name validation, message sanitation/length limits, and room access verification. |
| `meetings/meetings.service.ts` | Meeting room reservation management, advisory locking, and room lock notifications (`office:bookings`). |
| `tasks/tasks.service.ts` | Task Kanban mutations with real-time workspace broadcast distribution (`task:created`, `task:updated`, `task:deleted`). |
| `auth/session.gateway.ts` | WebSocket gateway on `/session` tracking active user tabs and pushing instant logout notifications on session family revocation. |
| `auth/session-events.ts` | In-memory RxJS Subject notifying gateways when user session families are revoked. |
| `dev/dev.gateway.ts` | Dev-only gateway on `/office` exposing `dev:teleport` for instant avatar repositioning during automated e2e testing. |
| `games/games.gateway.ts` | Minigames gateway on `/office` handling join/leave lifecycle, action dispatch, and action budgets (60/s). |
| `health/health.gateway.ts` | Unauthenticated root namespace (`/`) health gateway verifying WebSocket upgrade transport with `ping` and `whoami`. |

### Web (`apps/web/`)

| File | One-line job |
| --- | --- |
| `lib/socket.ts` | Socket.IO client factory creating pure WebSocket transport connections (`openSocket`) bypassing HTTP polling. |
| `features/office/connection.ts` | Core office socket client (`connectOffice`) handling player movement, presence rosters, tab takeover locks, and zone dispatch. |
| `features/office/useOfficeConnection.ts` | React hook binding office socket events to local state and the Phaser office controller. |
| `features/office/tabLockStore.ts` | Reactive module store managing multi-tab single-office locks (`busy`, `replaced`) and takeover callbacks. |
| `features/voice/VoiceManager.ts` | WebRTC peer connection manager coordinating spatial audio nodes, SDP signalling (`rtc:signal`), and proximity ticks. |
| `features/voice/VoiceControls.tsx` | Voice control bar synchronizing workspace mute/deafen statuses (`office:voice`, `voice:states`). |
| `features/voice/voiceStore.ts` | Global reactive store caching remote peer microphone and deafen states (`voiceStates`). |
| `features/chat/ChatPanel.tsx` | Chat drawer receiving real-time channel messages (`chat:message`) and avatar speech bubbles. |
| `features/chat/ChatComposer.tsx` | Chat input form transmitting messages via `chat:send` with timeout-backed acknowledgments. |
| `features/meetings/MeetingsPanel.tsx` | Meetings drawer listening to `office:bookings` to automatically refresh scheduled reservations. |
| `features/tasks/taskStore.ts` | Global task store synchronizing real-time task mutations (`task:created`, `task:updated`, `task:deleted`). |
| `features/auth/AuthProvider.tsx` | Authentication context maintaining the `/session` socket connection for instantaneous sign-out (`session:ended`). |
| `features/games/useGameSession.ts` | React networking hook managing minigame socket lifecycle (`game:join`, `game:leave`, `game:action`, `game:state`). |

---

## Connection and auth

### Handshake authentication

Authentication occurs before any WebSocket connection is accepted. The authentication flow is implemented in `apps/api/src/common/auth/socket-auth.ts`:

1. **Token Extraction**: The server inspects `socket.handshake.auth.token`. If omitted, it falls back to parsing the `access_token` cookie from `socket.handshake.headers.cookie`.
2. **JWT Verification**: The token is verified via `TokensService.verifyAccessToken(token)`. A valid token yields an `AuthUser` record (`{ id, email, sessionId }`), which is attached to `socket.data.user`.
3. **Rejection**: If the token is missing or invalid, the handshake fails immediately with `Error('NOT_AUTHENTICATED')`.

### Namespaces

DevPulse partitions WebSocket communication across three dedicated namespaces:

#### 1. `/office` (Primary virtual workspace)
- **Gateways**: `OfficeGateway`, `VoiceGateway`, `ChatGateway`, `GamesGateway`, `DevGateway`.
- **Middleware Guard**:
  - Authenticates via `authenticateSocket`.
  - Verifies session is alive via `TokensService.isSessionAlive(user.sessionId)` (rejects with `'SESSION_ENDED'`).
  - Verifies workspace membership via Prisma `workspaceMember` (rejects with `'NO_WORKSPACE'`).
  - Evaluates `tabId` (regex `/^[\w-]{8,64}$/`) and `takeover: boolean` from `socket.handshake.auth`.
  - Enforces single-tab office access via `claimOffice(...)`: if another tab is already open and `takeover !== true`, the handshake is rejected with `Error('ALREADY_OPEN')`.
- **Rooms Joined on Connection**:
  - `ws:<workspaceId>`: Broadcasts to all users in the workspace.
  - `user:<userId>`: Direct messages to all open sockets of a specific user.
  - `session:<sessionId>`: Direct messages scoped to the specific session family.

#### 2. `/session` (Global session lifecycle)
- **Gateway**: `SessionGateway` (`apps/api/src/auth/session.gateway.ts`).
- **Middleware Guard**: Verifies `authenticateSocket` and `TokensService.isSessionAlive(user.sessionId)`.
- **Rooms Joined**: `session:<sessionId>`.
- **Purpose**: Pushes immediate revocation signals (`session:ended`) to connected browser tabs when a user signs out, closes other sessions, changes passwords, or triggers security alerts.

#### 3. `/` (Root health diagnostic)
- **Gateway**: `HealthGateway` (`apps/api/src/health/health.gateway.ts`).
- **Middleware Guard**: None (remains unauthenticated to verify reverse proxy WebSocket upgrades).
- **Purpose**: Diagnostic probes (`ping`, `whoami`).

---

## Event tables

### Presence and movement

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `move` | Client &rarr; Server | Array: `[x: number, y: number, dir: 0\|1\|2\|3, moving: 0\|1\|boolean, seated?: 0\|1\|boolean]` | Server | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.move`)<br>`apps/web/features/office/connection.ts` (`sendMove`) |
| `office:moved` | Server &rarr; Client | Array: `[id: string, x: number, y: number, dir: 0\|1\|2\|3, moving: 0\|1, seated: 0\|1]` | All clients in workspace room except sender (`ws:<workspaceId>`) (Volatile emit) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.move`)<br>`apps/web/features/office/connection.ts` (`on('office:moved')`) |
| `zone` | Client &rarr; Server | `string \| null` (Zone/room ID matching `/^[\w:-]{1,64}$/` or `null` for open area) | Server | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.zone`)<br>`apps/web/features/office/connection.ts` (`sendZone`) |
| `office:zone` | Server &rarr; Client | Array: `[id: string, zone: string \| null]` | All clients in workspace room except sender (`ws:<workspaceId>`) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.zone`)<br>`apps/web/features/office/connection.ts` (`on('office:zone')`) |
| `office:state` | Server &rarr; Client | `{ players: PlayerState[] }`<br>where `PlayerState = { id: string, name: string, character: string, x: number, y: number, dir: 0\|1\|2\|3, moving: boolean, seated: boolean, status: string \| null, zone: string \| null }` | Connecting client only | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.join`)<br>`apps/web/features/office/connection.ts` (`on('office:state')`) |
| `office:joined` | Server &rarr; Client | `PlayerState` | All clients in workspace room except joining user (`ws:<workspaceId>`) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.join`)<br>`apps/web/features/office/connection.ts` (`on('office:joined')`) |
| `office:left` | Server &rarr; Client | `{ id: string }` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.handleDisconnect`)<br>`apps/web/features/office/connection.ts` (`on('office:left')`) |
| `office:updated` | Server &rarr; Client | `{ id: string, character?: string, role?: string, status?: string \| null }` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.onWorkspaceEvent`)<br>`apps/web/features/office/connection.ts` (`on('office:updated')`) |
| `office:removed` | Server &rarr; Client | `{ reason: 'removed' \| 'deleted' }` | Calling user's sockets (`user:<userId>`) on `'removed'`, or all clients in workspace (`ws:<workspaceId>`) on `'deleted'` | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.onWorkspaceEvent`)<br>`apps/web/features/office/connection.ts` (`on('office:removed')`) |

### Seats and desks

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `office:desks` | Server &rarr; Client | `{ desks: DeskOwner[] }`<br>where each item is `{ deskId: string, userId: string, name: string, character: string }` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.onWorkspaceEvent`)<br>`apps/web/features/office/connection.ts` (`on('office:desks')`) |

*Note: Sitting down or standing up at a desk chair is transmitted via the 5th element (`seated?: 0 | 1 | boolean`) of the `move` event and distributed via `office:moved`. Mutations to desk ownership occur over REST (`PUT /workspace/me/desk` and `PUT /workspace/members/:userId/desk`) and are broadcast via `office:desks`. See [Layout and desk events](#layout-and-desk-events) below for full details.*

### Voice signalling

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `rtc:signal` | Client &rarr; Server | `{ to: string, data: VoiceSignal }`<br>where `data` is WebRTC SDP or ICE payload (`{ description?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit, bye?: boolean }`). Max size: 16 KB. | Server | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.signal`)<br>`apps/web/features/voice/VoiceManager.ts` (`call`, `hangUp`) |
| `rtc:signal` | Server &rarr; Client | `{ from: string, data: VoiceSignal }` | Specific target peer socket in voice | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.signal`)<br>`apps/web/features/voice/VoiceManager.ts` (`onSignal`) |
| `rtc:refused` | Server &rarr; Client | `{ to: string }` | Calling client socket only | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.signal`)<br>`apps/web/features/voice/VoiceManager.ts` (`onRefused`) |
| `voice:state` | Client &rarr; Server | `{ muted: boolean, deafened: boolean }` | Server | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.state`)<br>`apps/web/features/voice/VoiceManager.ts` (`sendState`) |
| `office:voice` | Server &rarr; Client | Array: `[userId: string, muted: boolean \| null, deafened: boolean \| null]` (`null, null` signals leaving voice) | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.state`, `forget`)<br>`apps/web/features/voice/VoiceControls.tsx` (`on('office:voice')`) |
| `voice:leave` | Client &rarr; Server | None (`void`) | Server | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.leave`)<br>`apps/web/features/voice/VoiceManager.ts` (`leave`) |
| `voice:states` | Client &rarr; Server (Ack) | None (`void`).<br>Ack response: `[userId: string, muted: boolean, deafened: boolean][]` | Calling client only | `apps/api/src/voice/voice.gateway.ts` (`VoiceGateway.list`)<br>`apps/web/features/voice/VoiceControls.tsx` (`sync`) |

### Chat

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `chat:send` | Client &rarr; Server (Ack) | `{ channel: string, text: string }`.<br>Ack response: `{ ok: true, message: ChatMessageDto } \| { ok: false, error: { code: ChatErrorCode, message: string } }` | Calling client (receives ack); triggers `chat:message` broadcast | `apps/api/src/chat/chat.gateway.ts` (`ChatGateway.send`)<br>&rarr; `apps/api/src/chat/chat.service.ts`<br>`apps/web/features/chat/ChatComposer.tsx` (`send`) |
| `chat:message` | Server &rarr; Client | `ChatMessageDto`<br>`{ id: string, channel: string, userId: string, name: string, text: string, createdAt: string }` | All clients in workspace for `'office'`; or verified room occupants/attendees for room channels | `apps/api/src/chat/chat.service.ts` (`trySend`)<br>`apps/web/features/chat/ChatPanel.tsx` (`on('chat:message')`) |

### Meetings and room locks

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `office:bookings` | Server &rarr; Client | `{ changed: true }` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/meetings/meetings.service.ts` (`changed`)<br>`apps/api/src/office/office.gateway.ts` (`onWorkspaceEvent`)<br>`apps/web/features/meetings/MeetingsPanel.tsx` (`on('office:bookings')`) |

*Note: Meeting reservations, cancellations, and timeslot conflicts are mutated over REST (`POST /workspace/bookings` and `DELETE /workspace/bookings/:id`). When a reservation changes or layout deletion cancels meetings, the server broadcasts `office:bookings` to instruct clients to re-fetch active schedules.*

### Task synchronization

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `task:created` | Server &rarr; Client | `TaskView`<br>`{ id: string, key: string, number: number, type: TaskType, title: string, description: string, status: TaskStatus, priority: TaskPriority, assigneeId: string \| null, reporterId: string, dueDate: string \| null, rank: number, createdAt: string, updatedAt: string }` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/tasks/tasks.service.ts` (`TasksService.create`)<br>`apps/web/features/tasks/taskStore.ts` (`on('task:created')`) |
| `task:updated` | Server &rarr; Client | `TaskView` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/tasks/tasks.service.ts` (`TasksService.update`, `rebalanceColumnIfCrowded`)<br>`apps/web/features/tasks/taskStore.ts` (`on('task:updated')`) |
| `task:deleted` | Server &rarr; Client | `{ id: string }` | All clients in workspace room (`ws:<workspaceId>`) | `apps/api/src/tasks/tasks.service.ts` (`TasksService.remove`)<br>`apps/web/features/tasks/taskStore.ts` (`on('task:deleted')`) |

### Session (one-device takeover)

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `office:busy` | Server &rarr; Client | None (`void`) | Connecting socket (when another tab is open and takeover was not requested) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.join`)<br>`apps/web/features/office/connection.ts` (`on('office:busy')`) |
| `office:replaced` | Server &rarr; Client | None (`void`) | Existing active socket tab (when another tab connects with `takeover: true`) | `apps/api/src/office/office.gateway.ts` (`OfficeGateway.join`)<br>`apps/web/features/office/connection.ts` (`on('office:replaced')`) |
| `session:ended` | Server &rarr; Client (Namespace `/session`) | `{ reason: SessionEndReason }`<br>where reason is `'signed_out' \| 'sessions_closed' \| 'signed_in_elsewhere' \| 'password_changed' \| 'security_alert'` | All sockets in session family room (`session:<sessionId>`) | `apps/api/src/auth/session.gateway.ts` (`SessionGateway.afterInit`)<br>`apps/web/features/auth/AuthProvider.tsx` (`on('session:ended')`) |

### Dev tools (dev only)

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `dev:teleport` | Client &rarr; Server | Array: `[x: number, y: number]` in pixels | Server (resets speed tracking and emits `office:moved` to workspace) | `apps/api/src/dev/dev.gateway.ts` (`DevGateway.teleport`)<br>&rarr; `apps/api/src/office/office.gateway.ts`<br>`apps/web/features/office/connection.ts` (`teleport`) |

### Health and diagnostics (root namespace)

| Event name | Direction | Payload | Who receives | Handled in |
| --- | --- | --- | --- | --- |
| `ping` | Client &rarr; Server (Ack) | None (`void`). Ack response: `'pong'` | Calling client only | `apps/api/src/health/health.gateway.ts` (`HealthGateway.ping`)<br>`apps/web/components/StackStatus.tsx` |
| `whoami` | Client &rarr; Server (Ack) | None (`void`). Ack response: `{ userId: string \| null }` | Calling client only | `apps/api/src/health/health.gateway.ts` (`HealthGateway.whoami`) |

### Layout events

WebSocket layout events (`office:layout` and `office:desks`) and their accompanying REST endpoints are documented in the [Layout and desk events](#layout-and-desk-events) section below.

### Minigames events

Multiplayer minigames (Foosball, Uno, Lego) run on the `/office` namespace via `apps/api/src/games/games.gateway.ts`. For the complete table of minigame socket events (`game:join`, `game:leave`, `game:action`, `game:state`, `game:event`, `game:left`, `game:ended`, `game:error`, `lego:art`), see the [Socket events table in docs/code/games.md](games.md#socket-events-table).

---

## Layout and desk events

This section documents the WebSocket events and HTTP endpoints that manage office layouts, procedural wing expansions, template switches, and desk allocations.

### Protocol summary table

| Event / Endpoint | Direction | Payload | Who receives | API Handler | Web Handler |
| --- | --- | --- | --- | --- | --- |
| `GET /workspace` | Client &rarr; API (HTTP) | None (Authenticated session cookie) | Calling client | `WorkspaceController.mine`<br>in `apps/api/src/workspace/workspace.controller.ts` | SWR / page load fetching `MyWorkspace`<br>in `apps/web/features/workspace/` |
| `PUT /workspace/layout` | Client &rarr; API (HTTP) | `UpdateLayoutDto`<br>`{ version: number, furniture: FurnitureDto[], rooms: RoomNameDto[] }` | Calling client (receives `{ layout: OfficeLayout, version: number }`) | `WorkspaceController.updateLayout`<br>&rarr; `WorkspaceService.updateLayout`<br>in `apps/api/src/workspace/workspace.service.ts` | `save()` in `apps/web/features/office/useOfficeEditor.ts`<br>formatting via `LayoutEditor.toSave()` in `apps/web/game/editor/LayoutEditor.ts` |
| `POST /workspace/wings` | Client &rarr; API (HTTP) | `WingDto`<br>`{ side: 'LEFT' \| 'RIGHT' \| 'BOTTOM', version: number }` | Calling client (receives updated `MyWorkspace`) | `WorkspaceController.addWing`<br>&rarr; `WorkspaceService.addWing`<br>in `apps/api/src/workspace/workspace.service.ts` | `expand()` in `apps/web/features/team/ExpandOfficeCard.tsx` |
| `POST /workspace/wings/chill` | Client &rarr; API (HTTP) | `WingDto`<br>`{ side: 'LEFT' \| 'RIGHT' \| 'BOTTOM', version: number }` | Calling client (receives updated `MyWorkspace`) | `WorkspaceController.addChillWing`<br>&rarr; `WorkspaceService.addChillWing`<br>in `apps/api/src/workspace/workspace.service.ts` | `addChill()` in `apps/web/features/team/ExpandOfficeCard.tsx` |
| `PUT /workspace/template` | Client &rarr; API (HTTP) | `SwitchTemplateDto`<br>`{ templateId: string, teamSize?: number, version: number }` | Calling client (receives updated `MyWorkspace`) | `WorkspaceController.switchTemplate`<br>&rarr; `WorkspaceService.switchTemplate`<br>in `apps/api/src/workspace/workspace.service.ts` | `apply()` in `apps/web/features/team/TemplateSwitcher.tsx` |
| `PUT /workspace/me/desk` | Client &rarr; API (HTTP) | `MyDeskDto`<br>`{ deskId: string }` | Calling client (receives HTTP 204 No Content) | `WorkspaceController.moveDesk`<br>&rarr; `DesksService.move`<br>in `apps/api/src/workspace/desks.service.ts` | `claimDesk()` in `apps/web/features/office/useDeskInteractions.ts` |
| `PUT /workspace/members/:userId/desk` | Client &rarr; API (HTTP) | `DeskDto`<br>`{ deskId: string \| null }` | Calling client (receives HTTP 204 No Content) | `WorkspaceController.assignDesk`<br>&rarr; `DesksService.assign`<br>in `apps/api/src/workspace/desks.service.ts` | Member desk picker in `apps/web/features/team/MembersCard.tsx` |
| `office:layout` | Server &rarr; Client (WebSocket) | `{ layout: OfficeLayout, version: number, by: string }` | All clients in workspace room (`ws:<workspaceId>`) | Emitted by `OfficeGateway.onWorkspaceEvent`<br>in `apps/api/src/office/office.gateway.ts`<br>(subscribed to `WorkspaceEvents.events$`) | Listener in `apps/web/features/office/connection.ts`<br>&rarr; `onLayout` in `apps/web/features/office/useOfficeConnection.ts` |
| `office:desks` | Server &rarr; Client (WebSocket) | `{ desks: DeskOwner[] }`<br>where each item is `{ deskId: string, userId: string, name: string, character: string }` | All clients in workspace room (`ws:<workspaceId>`) | Emitted by `OfficeGateway.onWorkspaceEvent`<br>in `apps/api/src/office/office.gateway.ts`<br>(subscribed to `WorkspaceEvents.events$`) | Listener in `apps/web/features/office/connection.ts`<br>&rarr; `onDesks` in `apps/web/features/office/useOfficeConnection.ts` |

---

### Version semantics and concurrency control

1. **Optimistic Locking**:
   - The workspace table maintains an integer column `layoutVersion` (initialized to `1`).
   - Every mutation endpoint (`PUT /workspace/layout`, `POST /workspace/wings`, `POST /workspace/wings/chill`, `PUT /workspace/template`) requires the caller to provide their current `version: number`.
   - The API service executes an atomic conditional update:
     `prisma.workspace.updateMany({ where: { id: workspaceId, layoutVersion: dto.version }, data: { layout, layoutVersion: { increment: 1 } } })`
   - If `count !== 1`, another organizer saved changes concurrently. The server aborts the transaction and returns HTTP 400 with error code `LAYOUT_CHANGED`.

2. **Client-side Version Filtering**:
   - When the web client receives `office:layout` with payload `{ layout, version, by }`:
     - **Stale Updates**: If `version <= versionRef.current`, the broadcast is ignored.
     - **Author Save**: If `isEditingRef.current && by === myId`, the broadcast is ignored because the author's local editor state is already ahead and will apply the HTTP response directly.
     - **Concurrent Edit Notification**: If another organizer saves (`isEditingRef.current && by !== myId`), the client retains the current draft on screen and displays a toast notification (`"Another organiser just saved changes to the office."`). The user must reload the latest layout before saving.
     - **Live Office Update**: If the client is in game view (not editing), `versionRef.current` updates, the React workspace state updates, Phaser re-renders the office via `controllerRef.current.setLayout(layout)`, and a toast announces `"The office was rearranged by the organiser."` if `by !== myId`.

---

### Server event distribution flow

```
[REST HTTP Request] (PUT /workspace/layout, POST /workspace/wings, PUT /workspace/me/desk)
        |
        v
[WorkspaceService / DesksService]
  - Performs validation & atomic database transaction
  - Emits event on in-memory bus: this.events.emit({ type: 'layout' | 'desks', ... })
        |
        v
[WorkspaceEvents bus (RxJS Subject)]
        |
        v
[OfficeGateway.onWorkspaceEvent]
  - Updates in-memory office cache: office.layout = event.layout
  - Broadcasts via Socket.IO:
      server.to("ws:" + workspaceId).emit('office:layout', { layout, version, by })
      server.to("ws:" + workspaceId).emit('office:desks', { desks })
        |
        v
[Browser WebSocket connection (features/office/connection.ts)]
  - Receives 'office:layout' -> invokes handlers.onLayout(layout, version, by)
  - Receives 'office:desks'  -> invokes handlers.onDesks(desks)
        |
        v
[useOfficeConnection hook (features/office/useOfficeConnection.ts)]
  - Dispatches updates to Phaser game controller (setLayout / setDesks)
  - Updates local React store (setWorkspace)
```

1. **When and what the server emits**:
   - Following any successful layout modification, wing expansion, or template switch, the server emits `office:layout` to the workspace room containing the complete new `layout`, the newly incremented `version`, and the actor ID `by: userId`.
   - Layout changes trigger `desks.sync(workspaceId)`. If desk reallocations occurred (e.g. desks were added, moved, or deleted), the server also emits `office:desks` with the full roster of `{ deskId, userId, name, character }` records.
   - Moving or assigning a desk via `PUT /workspace/me/desk` or `PUT /workspace/members/:userId/desk` updates desk assignments and emits `office:desks` to the workspace room immediately.

---

## Rules and invariants

### 1. Rate limits and budgets
- **Movement & Zones**: Limited by `Budget(40)` (`MAX_MOVES_PER_SECOND = 40`). Packets exceeding 40/s per socket are discarded silently.
- **WebRTC Signalling**: Limited by `Budget(50)` (`MAX_SIGNALS_PER_SECOND = 50`). Payload size is capped at `MAX_SIGNAL_BYTES = 16_000` (16 KB) to prevent DoS via SDP bloat.
- **Chat**: Enforces `RateLimiter` (`apps/api/src/chat/chat.rules.ts`) at 1 message/sec (`WINDOW_MS = 1000`, `MAX_BURST = 1`). Violations fail with `'TOO_FAST'`. Text length is bounded to 1,000 characters (`MAX_TEXT_LEN`).
- **Games**: `GATEWAY_ACTION_BUDGET_PER_SEC = 60` via `Budget(60)` in `GamesGateway`. Lego enforces an additional 15 actions/sec per user.

### 2. Server validation vs client trust
- **Authoritative Positions & Speed Clamping**:
  - The server clamps coordinates to office layout bounds `[0, layout.width * TILE]` and `[0, layout.height * TILE]`.
  - The server verifies velocity using `limitMove(from, to, elapsedMs, spawn)`. Max distance per tick is `1.6 * WALK_SPEED * seconds + TILE` (`WALK_SPEED = 170 px/s`, `TILE = 16 px`). Jumps faster than walking are clamped along the trajectory toward the target.
  - Jumps within 3 tiles (`ARRIVAL_PX = 48 px`) of `spawn` are permitted without clamping to support initial spawn, layout reload, and meeting ejection.
- **Authoritative Room & Channel Authorization**:
  - Client-reported `zone` strings are used purely for HUD presence lists and are never trusted for security or privacy.
  - Access to room chat and WebRTC audio queries `OfficeGateway.locate(workspaceId, userId)`, which calculates the server-side room tile coordinates.
  - In booked meeting rooms, only verified attendees (`booking.attendeeIds`) may send or read messages (`'ROOM_LOCKED'`) and establish WebRTC audio connections.
- **Single Active Office Tab**:
  - `claimOffice` rejects secondary tabs of the same user unless `takeover: true` is explicitly sent.
  - Replaced tabs receive `office:replaced` and are disconnected after 300ms, permanently preventing dual-avatar ghosting.

### 3. Throttling and transport optimization
- **Volatile Sockets**: Both client and server use `volatile.emit` for high-frequency position packets (`move` and `office:moved`). If a client or server connection experiences buffer congestion, outdated movement frames drop instead of queueing, eliminating rubber-band lag.
- **Transport Pinning**: Sockets specify `transports: ['websocket']`, completely bypassing HTTP long-polling and socket upgrade latency.

---

## How to add an event safely

When introducing a new WebSocket event to the office protocol:

1. **Define Contracts & Types**:
   - Define TypeScript payload types in the API module (`src/<feature>/<feature>.dto.ts` or `.types.ts`) and mirror them in Web (`features/<feature>/types.ts`).
2. **Implement Server Gateway Handler**:
   - In the target gateway (`OfficeGateway`, `ChatGateway`, `VoiceGateway`), declare `@SubscribeMessage('domain:action')`.
   - Extract `userId` and `workspaceId` from `socket.data` (populated during handshake authentication).
   - Check socket rate budget: `if (!socket.data.budget.allow()) return;`.
   - Validate payload types strictly before delegating to domain services.
3. **Route Server Broadcasts Appropriately**:
   - Workspace-wide: `this.office.broadcast(workspaceId, 'domain:event', payload)` (emits to `ws:<workspaceId>`).
   - Single user (all their tabs): `this.office.sendTo(userId, 'domain:event', payload)` (emits to `user:<userId>`).
   - Specific connection: `this.office.sendToSocket(socketId, 'domain:event', payload)`.
4. **Wire Web Client Listeners**:
   - Attach listener inside a React `useEffect`: `socket.on('domain:event', handler)`.
   - **Always clean up**: Add `socket.off('domain:event', handler)` in the effect cleanup function to avoid listener leaks.
   - **Handle Reconnection**: Listen to `socket.on('connect', ...)` to re-synchronize state after offline periods.
5. **Verify Security Invariants**:
   - Never rely on client-supplied `userId` or `room` fields; use `socket.data.userId` and `OfficeGateway.locate()`.
   - If broadcasting high-frequency telemetry (>10 Hz), use `socket.volatile.emit`.

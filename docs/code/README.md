# Developer Architecture & Codebase Guide

## Purpose

This directory explains how DevPulse's codebase is designed, built, and executed. It is written for developers, maintainers, and 42 evaluators who want to inspect the system's architecture, data flows, invariants, and performance choices.

These technical deep-dives complement the high-level product and team documents in the parent directory:

- Product & vision: [../PLAN.md](../PLAN.md)
- Team ownership & state: [../HANDOFF.md](../HANDOFF.md)
- Virtual office features: [../OFFICE.md](../OFFICE.md)
- Authentication concepts: [../AUTH.md](../AUTH.md)
- Repository setup: [../../README.md](../../README.md)
- Asset design lab: [../../tools/art-lab/README.md](../../tools/art-lab/README.md)

### Code Documentation Index

| Guide | Scope and Architecture Summary |
| --- | --- |
| [auth.md](auth.md) | Passwords, OAuth 2.0 PKCE, TOTP 2FA, JWT rotation, session takeover, and cookies. |
| [conventions.md](conventions.md) | Module structure, web conventions, isolated dev hooks, comment policies, and mirrors. |
| [frontend.md](frontend.md) | Next.js 16 App Router architecture, domain feature folders, and reactive module stores. |
| [games.md](games.md) | Minigames engine (Foosball, Uno, Lego), authoritative physics, rules, and leaderboards. |
| [layout.md](layout.md) | Procedural office layout schema, 32px tile grid, furniture catalogs, walls, and wings. |
| [office-engine.md](office-engine.md) | Phaser 3 2D canvas, procedural avatar and furniture rendering, depth, and scenery baking. |
| [office-protocol.md](office-protocol.md) | Real-time WebSocket protocol on `/office` for spatial movement, chat, presence, and locks. |
| [performance.md](performance.md) | Hybrid WebGL/DOM optimizations, shape texture caching, frame budgeting, and sleep modes. |
| [tasks.md](tasks.md) | Kanban board issue tracking, drag-and-drop fractional ranking, and desk task counts. |
| [testing.md](testing.md) | Verification strategy: Vitest rules specs, typechecks, and multi-user Playwright e2e tests. |
| [voice.md](voice.md) | WebRTC peer-to-peer spatial audio mesh, HRTF 3D panning, and room acoustic isolation. |

---

## Repository Map

| Path | Purpose and Contents |
| --- | --- |
| `Makefile` | Container lifecycle automation: build, dev up, logs, clean rebuild, Prisma Studio. |
| `docker-compose.yml` | Production multi-container definition: Postgres, NestJS API, Next.js web, and Nginx. |
| `docker-compose.dev.yml` | Development overrides: volume mounts for hot-reload and exposed debug ports. |
| `nginx/` | Reverse proxy configuration (`nginx.conf`) and TLS self-signed certificate generation script. |
| `e2e/` | Playwright test suite validating multi-user browser scenarios, audio, and office physics. |
| `tools/art-lab/` | Standalone zero-dependency 2D canvas design tool for tuning avatar and furniture recipes. |
| `docs/` | High-level product specifications, handoff logs, operational guides, and architectural docs. |
| `docs/presentation/` | Slide decks and interactive HTML presentations explaining the system architecture. |
| `.github/workflows/ci.yml` | Continuous integration pipeline executing build, typecheck, unit tests, and e2e suites. |
| `apps/api/src/auth/` | Account registration, credentials login, OAuth, TOTP 2FA, token rotation, and sessions. |
| `apps/api/src/chat/` | In-office text chat persistence, channel history, and broadcast distribution. |
| `apps/api/src/common/` | Shared NestJS interceptors, decorators, CSRF origin middleware, and socket auth. |
| `apps/api/src/config/` | Environment validation and strongly typed runtime configuration factories. |
| `apps/api/src/dev/` | Dev-only controller and gateway for synthetic logins and instant avatar teleportation. |
| `apps/api/src/games/` | Minigames session orchestration, Foosball physics, Uno rules, Lego canvas, and scores. |
| `apps/api/src/health/` | Service health probe HTTP endpoint and WebSocket connection diagnostic pings. |
| `apps/api/src/invitations/` | Workspace email invitations, cryptographic token validation, and join acceptance. |
| `apps/api/src/mail/` | Transactional email delivery service using Nodemailer and HTML email templates. |
| `apps/api/src/meetings/` | Meeting room reservations, timetable scheduling, and advisory collision prevention. |
| `apps/api/src/office/` | Office presence tracking, movement validation, rate limits, and layout rules. |
| `apps/api/src/prisma/` | Prisma ORM database connection service and lifecycle management. |
| `apps/api/src/settings/` | User preferences for voice transmission (Open vs PTT) and custom keyboard binds. |
| `apps/api/src/tasks/` | Issue Kanban boards, fractional ranking calculations, and column rebalancing. |
| `apps/api/src/voice/` | WebRTC peer-to-peer signalling gateway and proximity earshot validation. |
| `apps/api/src/workspace/` | Workspace lifecycle, desk assignments, layout updates, and procedural wing additions. |
| `apps/api/prisma/schema.prisma` | Unified PostgreSQL database schema defining models, relations, and enums. |
| `apps/web/app/` | Next.js App Router entry points, auth route gates, and page layout wrappers. |
| `apps/web/components/` | Shared atomic UI component library (`ui/`), site header, footer, and status indicators. |
| `apps/web/features/auth/` | Authentication UI: login, signup, 2FA challenge, OAuth buttons, and session cards. |
| `apps/web/features/chat/` | Slide-out chat panel, channel tabs (room vs office), and speech bubble triggers. |
| `apps/web/features/dev/` | DevSwitcher identity dropdown, test hooks (`window.__devpulse`), and FPS caps. |
| `apps/web/features/games/` | Modal game chrome, Foosball canvas, Uno panel, Lego canvas, and weekly leaderboard. |
| `apps/web/features/meetings/` | Room reservation modal, daily scheduling timetable, and room occupation status. |
| `apps/web/features/office/` | Office canvas wrapper, HUD overlays, camera controls, minimap, and live layout editor. |
| `apps/web/features/onboarding/` | Workspace creation wizard, template picker, and procedural character creator. |
| `apps/web/features/settings/` | User security cards, password change forms, session managers, and keybind editor. |
| `apps/web/features/tasks/` | Kanban board drawer, card drag-and-drop, task filters, and issue authoring modals. |
| `apps/web/features/team/` | Workspace member roster, desk allocations, role changes, and invitation link tools. |
| `apps/web/features/voice/` | WebRTC audio manager, spatial panning, microphone controls, and voice preferences. |
| `apps/web/features/workspace/` | Shared avatar previewers, character customization studio, and layout thumbnails. |
| `apps/web/game/art/` | Procedural vector drawing recipes for avatars, hair, clothing, desks, and palettes. |
| `apps/web/game/editor/` | Interactive layout editor input handlers, drag state machine, and catalog definitions. |
| `apps/web/game/layout/` | Frontend layout derivations, tile metrics, desk seat math, and mount snapping. |
| `apps/web/game/objects/` | Phaser game objects: local Avatar, RemotePlayer, speech bubbles, and desk plates. |
| `apps/web/game/render/` | Procedural canvas drawing routines, static scenery baking, and wall face slicing. |
| `apps/web/game/scenes/` | Core Phaser scene (`OfficeScene.ts`) coordinating physics, camera, and input. |
| `apps/web/game/systems/` | Scene subsystems: seating, camera view control, net sync, and proximity. |
| `apps/web/lib/` | Cross-feature browser utilities: HTTP client, WebSocket helper, DOM, and Escape stack. |
| `apps/web/types/` | TypeScript ambient declarations and global type definitions. |
| `apps/web/proxy.ts` | Next.js Edge proxy middleware checking `signed_in` cookie hints for auth redirects. |

---

## How a Request Flows

### Architecture Topology

```
Browser Client
   │
   ▼ TLS :8443
Nginx Reverse Proxy
   │
   ├─── /api/* ───────────────► NestJS API (:4000) ───► Prisma ORM ───► PostgreSQL (:5432)
   ├─── /socket.io/* ─────────► NestJS Gateways (:4000)
   └─── /* (Pages & Assets) ──► Next.js Web (:3000)
```

### HTTP Flow: PUT /api/workspace/layout

1. **Client Call**: `apps/web/features/office/useOfficeEditor.ts` invokes `api('/workspace/layout', { method: 'PUT', body: ... })` via `apps/web/lib/api.ts`.
2. **Reverse Proxy**: `nginx/nginx.conf` terminates TLS on port 8443 and proxies `/api/*` to `http://api:4000`.
3. **Controller**: `apps/api/src/workspace/workspace.controller.ts` (`updateLayout`) parses `UpdateLayoutDto` and resolves the caller.
4. **Service**: `apps/api/src/workspace/workspace.service.ts` (`updateLayout`) checks workspace membership and permissions.
5. **Validation**: `apps/api/src/office/layout/validate.ts` (`validateLayout`) verifies building boundaries, solid wall clearances, mounted furniture snapping, item overlaps, and BFS avatar walkability from spawn to every desk and room.
6. **Persistence**: `apps/api/src/workspace/workspace.service.ts` executes `prisma.workspace.updateMany` with an optimistic `layoutVersion` increment.
7. **Internal Event**: `apps/api/src/workspace/workspace.service.ts` dispatches `this.events.emit({ type: 'layout', ... })`.
8. **Gateway Broadcast**: `apps/api/src/office/office.gateway.ts` (`onWorkspaceEvent`) broadcasts `office:layout` to the workspace socket room.
9. **Client Receive**: `apps/web/features/office/connection.ts` (`socket.on('office:layout')`) triggers registered event handlers.
10. **State Update**: `apps/web/features/office/useOfficeConnection.ts` updates React workspace state and invokes `controller.setLayout(layout)` on the Phaser scene.

### Socket Flow: `move` Event

1. **Movement Input**: Local player motion in `apps/web/game/scenes/OfficeScene.ts` triggers `apps/web/game/systems/NetSync.ts` (`sendPosition`), invoking `onMove()`.
2. **Socket Dispatch**: `apps/web/features/office/connection.ts` (`sendMove`) emits volatile WebSocket event `'move'` containing `[x, y, dir, moving, seated]`.
3. **Nginx Relay**: `nginx/nginx.conf` proxies the WebSocket frame on `/socket.io/` to port 4000.
4. **Gateway Handler**: `apps/api/src/office/office.gateway.ts` (`@SubscribeMessage('move') move`) receives the payload.
5. **Rules Enforcement**: `apps/api/src/office/office.rules.ts` evaluates token bucket rate limits (`data.budget.allow()`) and clamps movement velocity against `limitMove()` (`1.6 * WALK_SPEED * dt + 1 tile`).
6. **Room Broadcast**: `apps/api/src/office/office.gateway.ts` broadcasts `'office:moved'` to all other connected workspace sockets.
7. **Client Receive**: `apps/web/features/office/connection.ts` (`socket.on('office:moved')`) receives peer updates and calls `controller.movePlayer()`.
8. **Engine Delegation**: `apps/web/game/createGame.ts` routes the update to `apps/web/game/scenes/OfficeScene.ts` (`movePlayer`).
9. **Visual Interpolation**: `apps/web/game/systems/NetSync.ts` pushes the new position to the `RemotePlayer` (`apps/web/game/objects/RemotePlayer.ts`), which draws it 100 ms in the past and interpolates.

### Authentication & Cookie Handling

- **HttpOnly Cookies**: Credentials use secure `httpOnly` cookies (`access_token`, `refresh_token`), preventing script access and thwarting XSS attacks.
- **Client Auto-Refresh**: The fetch client in `apps/web/lib/api.ts` intercepts `401 Unauthorized` responses and silently requests `/api/auth/refresh` before retrying.
- **Guard Architecture**: NestJS enforces a global `AuthGuard` across all endpoints; routes open to the public are marked with `@Public()`. See [auth.md](auth.md).

---

## Where is X?

| I want to… | Look at | Detail Guide |
| --- | --- | --- |
| Change a role permission rule | `apps/api/src/workspace/membership.service.ts` | [frontend.md](frontend.md) |
| Add an API REST endpoint | `apps/api/src/tasks/tasks.controller.ts` | [conventions.md](conventions.md) |
| Add an office socket event | `apps/api/src/office/office.gateway.ts` | [office-protocol.md](office-protocol.md) |
| Change avatar walking speed | `apps/web/game/constants.ts` & `apps/api/src/office/office.rules.ts` | [office-engine.md](office-engine.md) |
| Add a placeable furniture kind | `apps/api/src/office/layout/types.ts` & `apps/web/game/render/furniture.ts` | [layout.md](layout.md) |
| Modify a built-in office template | `apps/api/src/office/templates/studio.ts` | [layout.md](layout.md) |
| Change proximity voice radius | `apps/web/game/systems/Proximity.ts` & `apps/api/src/voice/voice.rules.ts` | [voice.md](voice.md) |
| Adjust voice spatial volume curve | `apps/web/features/voice/spatial.ts` | [voice.md](voice.md) |
| Add a user keyboard shortcut | `apps/web/features/settings/keybinds.ts` | [frontend.md](frontend.md) |
| Add a new multiplayer minigame | `apps/api/src/games/games.registry.ts` & `apps/web/features/games/registry.ts` | [games.md](games.md) |
| Change task drag rank calculation | `apps/web/features/tasks/useBoardDrag.ts` & `apps/api/src/tasks/tasks.rules.ts` | [tasks.md](tasks.md) |
| Add a field to the Task model | `apps/api/prisma/schema.prisma` & `apps/api/src/tasks/tasks.dto.ts` | [tasks.md](tasks.md) |
| Modify the Escape key stack | `apps/web/lib/escape.ts` | [frontend.md](frontend.md) |
| Inspect dev login & teleport hooks | `apps/api/src/dev/dev.controller.ts` & `apps/web/features/dev/devHooks.ts` | [testing.md](testing.md) |
| Modify an e2e test helper | `e2e/tests/support/browser.ts` | [testing.md](testing.md) |
| Add a Prisma database model | `apps/api/prisma/schema.prisma` & `apps/api/src/prisma/prisma.service.ts` | [conventions.md](conventions.md) |
| Update Nginx reverse proxy rules | `nginx/nginx.conf` | [testing.md](testing.md) |
| Modify procedural avatar artwork | `apps/web/game/art/character.ts` & `apps/web/game/art/recipe.ts` | [office-engine.md](office-engine.md) |
| Update 2.5D wall slicing and graphics | `apps/web/game/render/walls.ts` & `apps/web/game/render/wallFaces.ts` | [office-engine.md](office-engine.md) |
| Modify meeting room booking rules | `apps/api/src/meetings/meetings.rules.ts` | [office-protocol.md](office-protocol.md) |
| Change text chat rate limit | `apps/api/src/chat/chat.rules.ts` | [office-protocol.md](office-protocol.md) |
| Change invitation token expiration | `apps/api/src/invitations/invitations.service.ts` | [auth.md](auth.md) |
| Change desk assignment logic | `apps/api/src/workspace/desks.service.ts` | [layout.md](layout.md) |
| Inspect single-tab takeover locking | `apps/api/src/office/office.rules.ts` & `apps/web/features/office/tabLockStore.ts` | [office-protocol.md](office-protocol.md) |
| Query minigame leaderboard scores | `apps/api/src/games/game-results.service.ts` & `apps/web/features/games/Leaderboard.tsx` | [games.md](games.md) |

---

## Recommended Evaluator Reading Order

1. **System Standards ([conventions.md](conventions.md))**: Read file patterns, comment requirements, dev isolation, and mirrored modules.
2. **Real-Time Protocol ([office-protocol.md](office-protocol.md))**: Understand the WebSocket events powering spatial movement, chat, and room presence.
3. **Office Layout & Wings ([layout.md](layout.md))**: Learn how grid tiles, structural boundaries, and procedural wing expansions operate.
4. **Game Engine & Rendering ([office-engine.md](office-engine.md))**: Review procedural graphics, Phaser integration, and avatar animations.
5. **Performance & Lag Tuning ([performance.md](performance.md))**: Discover why WebGL shape caches, zero-allocation loops, and throttling were engineered.
6. **Verification Strategy ([testing.md](testing.md))**: Examine the automated testing layers from pure mathematical rules to multi-user browser tests.

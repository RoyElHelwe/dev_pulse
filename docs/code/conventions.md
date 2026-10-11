# Codebase Conventions & Standards

## Purpose

This document establishes the architecture patterns, folder layouts, commenting requirements, and code synchronization rules used across DevPulse. Evaluators and contributors can refer here to understand why files are structured the way they are and how to safely extend features.

---

## 1. Backend Module Layout (`apps/api/src/`)

Every domain feature inside the NestJS API follows a standardized file taxonomy:

| File Pattern | Role and Architectural Boundary |
| --- | --- |
| `<f>.module.ts` | NestJS DI module registering controllers, services, and gateways. |
| `<f>.controller.ts` | HTTP REST endpoints: validates input DTOs and delegates to service. |
| `<f>.service.ts` | Business orchestration, PostgreSQL queries, and Prisma transactions. |
| `<f>.gateway.ts` | Socket.IO incoming WebSocket event handlers (`@SubscribeMessage`). |
| `<f>.rules.ts` | Pure functional domain logic and constants; zero network, DB, or framework I/O. |
| `<f>.dto.ts` | Request/response payload schemas decorated with `class-validator`. |
| `<f>.rules.spec.ts` | Fast, deterministic Vitest unit tests verifying pure calculation logic. |
| `<f>.service.spec.ts` | Vitest unit tests verifying service mutations, permissions, and edge cases. |

### Concrete Example: `apps/api/src/tasks/`
- `apps/api/src/tasks/tasks.module.ts`: Wires controller, service, Prisma, and office gateway.
- `apps/api/src/tasks/tasks.controller.ts`: REST endpoints under `/api/workspace/tasks`.
- `apps/api/src/tasks/tasks.service.ts`: Task CRUD operations, optimistic locks, and DB writes.
- `apps/api/src/tasks/tasks.rules.ts`: Pure midpoint rank math, rebalance threshold, and permissions.
- `apps/api/src/tasks/tasks.dto.ts`: Validation DTOs (`CreateTaskDto`, `UpdateTaskDto`).
- `apps/api/src/tasks/tasks.rules.spec.ts`: Unit tests for pure rank math and delete permissions.
- `apps/api/src/tasks/tasks.service.spec.ts`: Unit tests for assignee verification and removals.

*Note*: `auth/` maintains a `dto/` directory due to high schema volume; subdomains nest subfolders (`office/layout/`, `office/templates/`, `games/foosball/`).

---

## 2. Frontend Layout & Naming (`apps/web/`)

Web code is partitioned into domain feature packages under `apps/web/features/`:

- `PascalCase.tsx`: React components (one primary component per file, matching the filename, e.g. `apps/web/features/office/EditorPanel.tsx`).
- `useThing.ts`: Custom React hooks encapsulating lifecycle or browser integrations (e.g. `apps/web/features/tasks/useBoardDrag.ts`).
- `thingStore.ts`: Reactive module-level state stores built with `useSyncExternalStore` (e.g. `apps/web/features/tasks/taskStore.ts`).
- `camelCase.ts`: Pure helper functions, domain utilities, or types (e.g. `apps/web/features/tasks/boardFilterUtils.ts`).
- `apps/web/lib/`: Cross-feature, domain-agnostic utilities (e.g. `apps/web/lib/api.ts`, `apps/web/lib/escape.ts`).
- `apps/web/game/`: Phaser 3 rendering engine, game loops, and visual systems, isolated from React renders.

---

## 3. Dev & Test-Only Code Isolation

Dev and test utilities are strictly quarantined so they cannot compromise production:

- **API (`apps/api/src/dev/`)**: Contains `dev.controller.ts` (instant test sign-in) and `dev.gateway.ts` (`dev:teleport` socket event). It is packaged in `apps/api/src/dev/dev.module.ts` and loaded by `apps/api/src/app.module.ts` via `...devImports(process.env)`.
- **Production Gating**: Never active in production because `isDevLoginEnabled` in `apps/api/src/config/app-config.ts` requires both `DEV_LOGIN === 'true'` and `NODE_ENV !== 'production'`. When either condition fails, `devImports` returns an empty array, and the NestJS router mounts no dev endpoints or gateways.
- **Web (`apps/web/features/dev/`)**: Contains `DevSwitcher.tsx` and `devHooks.ts` (`window.__devpulse` for Playwright teleportation and FPS caps). Web hooks call `useDevLogin.ts`, which queries `/api/auth/dev`; if disabled, hooks are never attached to `window`. Every dev file begins with: `// Dev/test only: ... never active in production because ...`.

---

## 4. Comment & Code Style Policy

1. **File Headers**: Every file begins with a 1–3 line header stating what it is for and where it fits in the architecture.
2. **JSDoc**: Every exported function, interface, class, hook, and React component has a JSDoc summary.
3. **WHY Comments**: Document non-obvious invariants, protocol constraints, performance tricks, or workarounds.
4. **No Code Restatement**: Never write comments that merely repeat what the code does.
5. **Cleanliness**: No commented-out code; no TODOs without an owner.

---

## 5. Named Constants with Units

Every numeric literal representing a physical or temporal metric must be an uppercase constant declaring its unit:

- `WALK_SPEED = 170`: Player walking speed in pixels/second (`apps/web/game/constants.ts` and `apps/api/src/office/office.rules.ts`).
- `PROXIMITY_TICK_MS = 100`: Interval in milliseconds between spatial voice distance evaluations (`apps/web/game/constants.ts`).
- `SAVE_DEBOUNCE_MS = 400`: Delay in milliseconds before persisting collaborative Lego brick edits (`apps/api/src/games/lego/lego.service.ts`).
- `RATE_LIMIT_WINDOW_MS = 5000`: Sliding window in milliseconds for chat throttling (`apps/api/src/chat/chat.rules.ts`).

---

## 6. Sizing & Documentation Template

- **Size Guidelines**: Aim for functions $\le$ 60 lines and files $\le$ 400 lines. Splits must follow natural domain responsibilities.
- **Documentation Template**: Architecture guides under `docs/code/` follow: **Purpose · Where it lives · How it works · Rules & invariants · Why it's built this way · How to change safely · Tests**.

---

## 7. Verification Gates & Commits

Run these commands before pushing any change:

- **Typecheck**: `pnpm typecheck` in both `apps/web` and `apps/api`.
- **API Unit Tests**: `pnpm test` in `apps/api` (runs Vitest rules specs).
- **E2E Browser Suite**: Run Playwright under an exclusive file lock (see [testing.md](testing.md)):
  `flock /tmp/e2e.lock bash -c 'cd ~/projects/dev_pulse/e2e && . ~/.nvm/nvm.sh && E2E_BASE_URL=https://localhost:8443 pnpm exec playwright test'`
- **Commit Style**: Use concise, imperative commit messages (e.g. `Engine: add FurnitureSprites system`).

---

## 8. Mirrors: Code That Exists Twice

### Why No Shared Package?
Docker build contexts are isolated per application: `apps/api` and `apps/web` build independently without root workspace sharing (see [../../README.md](../../README.md)). To avoid build-time coupling, a small set of contracts and geometric calculations exist on both sides.

### Mirrored Files Inventory

| Web File | API File | Relationship | How Each Side Uses It |
| --- | --- | --- | --- |
| `apps/web/game/layout/mount.ts` | `apps/api/src/office/layout/mount.ts` | Identical logic | Web uses it in `apps/web/game/editor/EditMode.ts` to snap wall-hung items while dragging; API uses it in `apps/api/src/office/layout/validate.ts` to reject floating items (`NOT_ON_WALL`). |
| `apps/web/game/layout/types.ts` | `apps/api/src/office/layout/types.ts` | Shared core contracts | Core types (`Room`, `Wall`, `FurnitureKind`, `Furniture`, `OfficeLayout`) match. Web adds `Zone`/`ZoneType`; API derives `FurnitureKind` from `FURNITURE_KINDS` const array. |
| `apps/web/game/layout/geometry.ts` | `apps/api/src/office/layout/geometry.ts` | Overlapping subset | Shared: `Rect`, `itemBounds`, `seatPoint`, `numberedDesks`, `overlaps`. API adds `TILE`, `SOLID`, `wallRect`, and `toPixels` (which live in `apps/web/game/constants.ts`, `apps/web/game/render/furniture.ts`, and `apps/web/game/render/walls.ts`). |
| `apps/web/game/editor/rules.ts` | `apps/api/src/office/layout/validate.ts` | Client preview vs server authority | `rules.ts` checks 4 rules live during drag (`outside`, `notOnWall`, `wall`, `overlap`) for `apps/web/features/office/EditorPanel.tsx`. `validate.ts` enforces 7 authoritative checks on save including BFS reachability (`SPAWN_BLOCKED`, `DESK_UNREACHABLE`, `ROOM_UNREACHABLE`) in `apps/api/src/workspace/workspace.service.ts`. If they disagree, the server wins. |
| `apps/web/game/constants.ts` (`WALK_SPEED`) | `apps/api/src/office/office.rules.ts` (`WALK_SPEED`) | Independent numeric copies | Value `170` px/s. Web moves the local player avatar in `apps/web/game/scenes/OfficeScene.ts`. API uses its copy in `limitMove` to compute the anti-teleport budget (`1.6 * WALK_SPEED * dt + 1 tile`). If you change one, update both. |
| `apps/web/features/tasks/useBoardDrag.ts` (`rankBetween`) | `apps/api/src/tasks/tasks.rules.ts` (`rankBetween`) | Client runtime vs tested reference | Web executes `rankBetween` on drag drop for instantaneous UI card positioning. The API copy in `tasks.rules.ts` is the unit-tested reference (`tasks.rules.spec.ts`) and is not imported by `apps/api/src/tasks/tasks.service.ts`. The service accepts `dto.rank` as sent and rebalances only when neighbours violate `RANK_GAP_MIN`. |

### How to Keep Mirrors in Sync
1. Whenever modifying a mirrored file, immediately edit its counterpart.
2. Run `pnpm typecheck` in both `apps/web` and `apps/api`.
3. Run `pnpm test` in `apps/api`.
4. Run the Playwright e2e suite (`e2e/tests/office.spec.ts` covers the editor, `e2e/tests/board.spec.ts` the tasks board).
5. For in-depth rules, consult [layout.md](layout.md) and [tasks.md](tasks.md).

# Frontend Architecture (`apps/web`)

## Purpose

The web application is a real-time virtual office environment built on Next.js 16 and Phaser 3. It combines retro 2D spatial presence with web workspace collaboration tools: proximity-based WebRTC voice chat, channel text chat, an interactive Kanban board with physical desk indicators, room scheduling, arcade mini-games, and an in-browser layout editor for office organisers—all synchronized in real time over a single Socket.IO connection.

## Where it lives

| File / Folder | Job |
| --- | --- |
| `apps/web/app/` | Next.js App Router route entry points, root layout, and auth page gates |
| `apps/web/proxy.ts` | Edge request middleware checking `signed_in` cookie hints for fast page redirects |
| `apps/web/features/` | Modular domain feature packages (components, hooks, stores, and types) |
| `apps/web/components/` | Shared UI component library (`components/ui/`) and static layout chrome (`AppHeader`, `SiteFooter`) |
| `apps/web/lib/` | Cross-feature utilities: HTTP API client, WebSocket transport, DOM helpers, and Escape stack |
| `apps/web/game/` | Phaser 3 game engine: tilemap rendering, physics, sprite animations, and layout editor |

## How it works

### Feature Folders & Naming Conventions
Code is partitioned into domain directories under `apps/web/features/`. Within each feature:
- `PascalCase.tsx`: React UI components (e.g. `OfficeHud.tsx`, `BoardDrawer.tsx`).
- `useThing.ts`: Custom React hooks (e.g. `useOfficeConnection.ts`, `useBoardDrag.ts`).
- `thingStore.ts`: Module-level external state stores built with React 19 `useSyncExternalStore`.
- `camelCase.ts`: Pure functions, schemas, or non-hook helper modules (e.g. `connection.ts`, `events.ts`).
- `apps/web/lib/`: Cross-feature non-domain utilities (e.g. `api.ts`, `escape.ts`, `socket.ts`, `dom.ts`).
- `apps/web/game/`: Phaser 3 rendering engine, game loops, sprite systems, and geometry math.

| Feature Folder | Job |
| --- | --- |
| `features/auth/` | Session provider, OAuth buttons, credentials forms, 2FA validation, and active session alerts |
| `features/chat/` | In-office text chat panel, channel tabs (office-wide vs. current room), and real-time message stream |
| `features/dev/` | Test automation hooks (`window.__devpulse`), fast identity switcher, and e2e frame caps |
| `features/games/` | Multiplayer mini-games (Foosball, Uno, collaborative Lego canvas) and session host overlays |
| `features/meetings/` | Meeting room booking modal, daily reservation timetable, and room occupation status |
| `features/office/` | Office canvas wiring, HUD overlays, camera controls, minimap, multi-tab locks, and layout editor |
| `features/onboarding/` | First-time setup wizard: workspace naming, procedural office template picker, and character studio |
| `features/settings/` | User profile management, password resets, active browser session cards, and keybind modal |
| `features/tasks/` | Kanban task board drawer, column filtering, task modal dialogs, and optimistic task mutations |
| `features/team/` | Workspace member administration, email invitation links, role assignments, and template switches |
| `features/voice/` | WebRTC spatial voice chat, proximity falloff, microphone/deafen controls, and input audio settings |
| `features/workspace/` | Shared character avatar studios, layout previews, and workspace membership type models |

### State Stores (`*Store.ts`)
Global client state avoids heavy frameworks and uses lightweight singleton module closures subscribed via `useSyncExternalStore`:
- `features/office/tabLockStore.ts`: Holds single-tab concurrency state (`'busy' | 'replaced' | null`) and takeover callback. Used by `connection.ts` (sets state on server socket conflict) and `TabLock.tsx` (shows takeover modal).
- `features/office/editorStore.ts`: Subscribes to `LayoutEditor` instances (dirty state, tool, undo/redo, catalog selection, validation errors). Used by `EditorPanel.tsx` to render organiser tools.
- `features/tasks/taskStore.ts`: Holds workspace tasks list (`tasks: TaskView[]`), key prefix, and loading flag. Provides optimistic `taskActions`. Used by `useOfficeBoard.ts` (desk paper stack counts), `OfficeHud.tsx` (badge counter), `TaskBoard.tsx`, and task dialogs.
- `features/voice/voiceStore.ts`: Holds map of connected voice users (`ReadonlyMap<string, VoiceState>` with `muted` and `deafened` flags). Populated by `VoiceControls.tsx` from socket events; read by `VoiceManager.ts` (peer connections) and `PresenceList.tsx` (mic badges).
- `features/settings/keybindStore.ts`: Holds user keybindings (`Keybinds`) with server persistence (`/settings`) and optimistic rebinding. Used by `useKeybind` across HUD panels, game handlers via `getKeybinds()`, and `KeybindsModal.tsx`.

### Sockets & Event Propagation
- **Connection**: `useOfficeConnection.ts` calls `connectOffice()` in `features/office/connection.ts`, which invokes `openSocket('/office', ...)` from `lib/socket.ts`. Connections run directly over WebSocket (skipping long-polling) passing a unique browser `tabId` and `takeover` flag.
- **Game-to-HUD Event Bus**: In-game Phaser systems communicate with React through a typed in-process emitter (`officeEvents` in `features/office/events.ts`). `Proximity.ts` emits `player:near`, `player:distance`, `player:far`; `OfficeScene.ts` emits `zone:enter`, `zone:leave`; `Interactions.ts` emits `object:interact`.
- **Feature Event Dispatching**:
  - `features/office/connection.ts`: Listens to `office:state`, `office:joined`, `office:moved`, `office:left`, `office:updated`, `office:zone`, `office:desks`, `office:layout`, `office:removed`, `office:busy`, `office:replaced`.
  - `features/tasks/taskStore.ts`: Listens to `task:created`, `task:updated`, `task:deleted`.
  - `features/voice/VoiceControls.tsx` & `VoiceManager.ts`: Listen to `office:voice`, `rtc:signal`, `rtc:refused`.
  - `features/chat/ChatPanel.tsx`: Listens to `chat:message`.
  - `features/games`: Listen to `foosball:*`, `uno:*`, and `lego:sync`.
  - *(Note: `features/auth/AuthProvider.tsx` separately connects to `/session` for `session:ended`).*

### HUD Panel Wiring Example (Tasks Board Drawer)
1. **Composition**: `OfficeView.tsx` calls `useOfficeBoard({ socket, controller, ready, isEditing })`.
2. **Keybind Registration**: `useOfficeBoard.ts` attaches `useKeybind('board', toggleBoard, !isEditing)` (bound to `KeyB`).
3. **HUD Button**: `OfficeView.tsx` passes `boardOpen` and `toggleBoard` to `OfficeHud.tsx`, which renders a `<Panel>` button with `<KanbanSquare>` and task badge count.
4. **Drawer Mounting**: `OfficeView.tsx` wraps the canvas with `<BoardDrawer open={boardOpen} onOpenChange={setBoardOpen} onPush={pushView} drawer={<TaskBoard open={boardOpen} onClose={closeBoard} ... />}>`.
5. **Animation & Camera Shift**: Opening slides `BoardDrawer.tsx` in from the right and calls `onPush(shift)`, instructing `controller.setViewShift(shift)` to pan the Phaser camera so the avatar stays in view.
6. **Dismissal & Throttling**: `TaskBoard.tsx` handles Escape via `useEscape(open, onClose)`. Once settled (`BOARD_SETTLE_DELAY_MS`), `useOfficeBoard` throttles Phaser frame rendering to conserve CPU/GPU.

### The Esc Stack
Escape handling is centralized in `apps/web/lib/escape.ts`:
- **Module Stack**: Maintains an in-memory LIFO array `stack: Layer[] = []`.
- **Capture-Phase Listener**: Calls `window.addEventListener('keydown', onKeyDown, true)` on first layer registration. The capture phase intercepts the event before the Phaser game canvas or focused DOM inputs can trap it.
- **Topmost Layer Execution**: When `e.key === 'Escape'`, it targets strictly the last registered layer (`stack[stack.length - 1]`), halts bubbling (`e.preventDefault()`, `e.stopImmediatePropagation()`), and invokes `top.handler()`.
- **Component Lifecycle (`useEscape(active, onEscape)`)**: When `active` is true, registers `{ handler: () => ref.current() }` and splices it off on unmount or deactivation. Nested modals dismiss in reverse order of opening; when empty, Escape passes to game controls.

### Keybind System
- **Definitions & Rules (`features/settings/keybinds.ts`)**: Defines `KEYBIND_ACTIONS` (`interact`, `mute`, `deafen`, `pushToTalk`, `chat`, `board`, `rooms`, `people`), layout-agnostic `DEFAULT_KEYBINDS` (`KeyE`, `KeyM`, `KeyH`, `KeyV`, `KeyC`, `KeyB`, `KeyT`, `KeyP`), and unbindable `RESERVED_KEYS` (WASD, arrows, Escape, Enter, Tab).
- **Store & Hook (`features/settings/keybindStore.ts`)**: Loads user preferences lazily via `GET /settings`. `rebind(action, code, { swap })` validates input, resolves collisions, optimistically updates state, and persists with `PATCH /settings`.
- **Input Guarding**: `useKeybind(action, handler, enabled)` skips execution if `isTyping()` (`lib/dom.ts`) detects focus inside an input, textarea, or contenteditable element (or inside an element with `data-captures-keys`).
- **Adding an Action**: Add the key to `KEYBIND_ACTIONS`, `DEFAULT_KEYBINDS`, and `KEYBIND_LABELS` in `features/settings/keybinds.ts` (and mirror in backend `apps/api/src/settings/keybinds.ts`), then invoke `useKeybind(action, ...)` in consumer components.

### Dev/Test-Only Code (`features/dev/`)
- **What exists**: `devHooks.ts` (`useDevHooks`) injects `window.__devpulse` (`teleport(x, y)` and `position()`), frame-rate cap `__devpulseFps`, and `__devpulseLowRes` for Playwright E2E automation (`e2e/tests/support/office.ts`). `DevSwitcher.tsx` and `useDevLogin.ts` render an instant user-switching modal on `/login` and `/register`.
- **Why never in production**: On mount, `useDevLogin` queries `GET /auth/dev`. The backend only enables `DevModule` when `DEV_LOGIN=true` (never set in production). If disabled, `useDevHooks` removes `window.__devpulse`, `DevSwitcherGate` renders regular auth forms, and `dev:teleport` socket events are rejected by the server.

### OfficeView Composition
`apps/web/features/office/OfficeView.tsx` is pure wiring without business logic or custom styling beyond container layout:
- `useOfficeConnection`: Authenticates workspace session, boots Phaser canvas inside `containerRef`, connects to `/office` socket, and exposes game controller and presence list.
- `useOfficeEditor`: Manages organiser `LayoutEditor` mode, draft modifications, reset to template, beforeunload dirty warnings, and layout persistence.
- `useOfficeBoard`: Synchronizes Kanban board drawer visibility, filter selections, desk paper stack counters, and Phaser render throttling.
- `useDeskInteractions`: Handles `object:interact` events on desks, desk claiming prompts (`MoveDeskPrompt`), and desk reassignment API calls.
- `OfficeFeatures`: Mounted live feature overlay rendering `VoiceControls`, `ChatPanel`, `MeetingsPanel`, `GameHost`, and `LegoSync`.
- `OfficeOverlays`: Viewport overlay container pinned outside sliding drawer for `OfficeNotices` (toasts, offline banners) and `TabLock` takeover alerts.

## Rules & invariants

- **Single-Tab Concurrency**: Only one browser tab may hold an active office session per user. Secondary tabs receive `office:busy` or `office:replaced` and show `TabLock.tsx`, disabling game loops until "Use here" is clicked.
- **No Phaser in SSR**: Phaser references `window` and canvas APIs at import time. It must be dynamically imported on the client inside `useEffect` after `document.fonts.ready`.
- **Typing Guard**: All global keybinds must check `isTyping()` (`lib/dom.ts`) to avoid firing while users type in input fields, textareas, or rich text editors.
- **LIFO Escape Registration**: Modals, popovers, and drawers must use `useEscape` so Escape dismisses solely the topmost active UI layer.
- **Zero-Dependency Module Stores**: State stores use native `useSyncExternalStore` module closures. They expose synchronous getters (`getKeybinds()`, `voiceStates.get()`) so non-React code (Phaser systems, socket handlers) can access state without React context.
- **Optimistic Rollback**: Direct user mutations (Kanban card movements, keybind updates) apply immediately to the store snapshot and roll back to previous state if API persistence fails.
- **Optimistic Layout Locks**: Office layout updates track `layoutVersion`. Organiser saves send the base version to prevent overwriting concurrent edits (`LAYOUT_CHANGED`).

## Why it's built this way

- **WebSocket-Only Connection (`lib/socket.ts`)**: Avoids Socket.IO's default HTTP long-polling upgrade step. This eliminates broken requests and socket disconnect noise during fast navigation, sleeping laptops, or unmounting components.
- **Native `useSyncExternalStore` vs. Redux/Zustand**: Keeps bundle size minimal with zero external state libraries. Allows game loops and socket callbacks outside React to read and mutate state synchronously without React lifecycle wrappers.
- **Capture-Phase Escape Stack (`lib/escape.ts`)**: Listening on the capture phase (`window.addEventListener('keydown', onKeyDown, true)`) guarantees Escape is processed before Phaser or nested form components swallow the event.
- **Single Multiplexed `/office` Socket**: All office domains (chat, voice signaling, tasks, games) share the `/office` gateway connection instead of opening separate WebSockets, minimizing server connection overhead and keeping presence unified.
- **Phaser Viewport Camera Shift (`BoardDrawer.tsx`)**: The drawer shifts the entire viewport and updates Phaser camera offset (`controller.setViewShift`), keeping the player avatar visible on screen rather than obscured behind the drawer.
- **Engine Throttling on Overlay (`useOfficeBoard.ts`)**: When the Kanban board drawer settles or mini-games open, Phaser throttles or pauses rendering, saving battery and GPU cycles.

## How to change it safely

### Walk-Through: Add a New HUD Panel
1. **Define Keybind** *(optional)*: In `apps/web/features/settings/keybinds.ts`, add the action identifier to `KEYBIND_ACTIONS`, assign default code in `DEFAULT_KEYBINDS`, and add title/hint in `KEYBIND_LABELS`. Mirror changes in backend `apps/api/src/settings/keybinds.ts`.
2. **Create Panel Component**: Create `apps/web/features/<feature>/<PanelName>.tsx`:
   - Accept `OfficeFeatureProps` (`socket`, `controller`, `workspace`, `editing`, etc.).
   - Use `const [open, setOpen] = useState(false)`.
   - Add keybind toggle: `useKeybind('<action>', () => setOpen((o) => !o), !editing)`.
   - Add Escape dismissal: `useEscape(open, () => setOpen(false))`.
   - Wrap visual panel in `<Panel>` from `@/components/ui/Panel`.
3. **Mount in Office Features**: In `apps/web/features/office/OfficeFeatures.tsx`, mount `<PanelName {...features} />`.
4. **Add HUD Trigger Button**: In `apps/web/features/office/OfficeHud.tsx`, add an icon button inside the top-right `<Panel>` cluster calling the panel toggle.
5. **Connect Game Events** *(optional)*: If the panel opens upon proximity or object interaction, subscribe to `officeEvents.on('object:interact', ...)` or `zone:enter` in a `useEffect`.
6. **Verify Types**: Run `pnpm --filter web typecheck` to verify complete type safety.

## Tests

- **Framework**: End-to-end testing with Playwright in `e2e/tests/` (`office.spec.ts`, `board.spec.ts`, `chill.spec.ts`, `foosball.spec.ts`, `lego.spec.ts`, `uno.spec.ts`).
- **Test Commands**:
  - Type checking: `pnpm --filter web typecheck` (runs `tsc --noEmit`).
  - Playwright E2E suite: `pnpm --filter e2e test` or `pnpm test`.
- **Test Automation Hooks**: E2E tests bypass character walking collisions by calling `window.__devpulse.teleport(x, y)` installed by `devHooks.ts` (`useDevHooks`) when `DEV_LOGIN=true`.

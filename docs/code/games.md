# Office Minigames Framework

## Purpose

The office minigames framework enables interactive, real-time multiplayer minigames (Foosball, Uno, Lego) embedded directly in DevPulse's 2D virtual office. Players interact with physical office furniture (Foosball tables, Card tables, Lego walls) via spatial proximity, opening an overlay game panel that communicates through low-latency WebSockets. The system provides authoritative server-side simulation and validation, role-based permissions, privacy-preserving state projection (hiding secret cards), match outcome logging, and weekly workspace leaderboards.

## Where it lives

### API (`apps/api/src/games/`)

| File | One-line job |
| --- | --- |
| `game.types.ts` | Core engine contracts (`GameInstance`, `GameContext`, `GameDefinition`, `GamePlayerRef`, `GameError`). |
| `games.session.ts` | Session lifecycle manager (`GameSession`, `GamesSessionManager`), transport dispatch, and 1s proximity sweep loop. |
| `games.gateway.ts` | WebSocket gateway (`/office`) handling `game:join`, `game:leave`, `game:action`, and rate limiting. |
| `games.registry.ts` | In-memory registry mapping `GameKind` identifiers to `GameDefinition` engine factories. |
| `game-results.service.ts` | Match results persistence in PostgreSQL via Prisma (`GameResult`) and ranked leaderboard aggregation. |
| `games.controller.ts` | REST controller serving `GET /workspace/games/leaderboard` for workspace members. |
| `games.dto.ts` | Query DTO validation for the leaderboard endpoint (`LeaderboardQueryDto`). |
| `proximity.ts` | Euclidean tile distance calculations and join/leave threshold definitions. |
| `games.module.ts` | Root NestJS games module importing core infrastructure and game submodules. |
| `games-core.module.ts` | Shared NestJS module exporting `GamesRegistry` and `GameResultsService`. |
| `foosball/foosball.roster.ts` | Pure seating roster management: seat/stand rules, team balance, and rod ownership assignment. |
| `foosball/foosball.actions.ts` | Foosball client action handlers (sit, stand, start, aim, move, kick, rematch). |
| `foosball/foosball.game.ts` | Foosball game session wiring, match lifecycle timers, physics simulation loop, and state projection. |
| `foosball/foosball.physics.ts` | Deterministic 2D foosball physics engine (120x64 field, 30 Hz, 4 substeps, ball, rods, walls, kicks). |
| `foosball/foosball.module.ts` | NestJS module registering Foosball with `GamesRegistry`. |
| `uno/uno.rules.ts` | Pure Uno engine: 108 cards, deck construction, move legality, draw stacking, turn orders, and scoring. |
| `uno/uno.game.ts` | Uno session wiring connecting rules engine to session sockets, participant events, and actions. |
| `uno/uno.module.ts` | NestJS module registering Uno with `GamesRegistry`. |
| `lego/lego.rules.ts` | Pure Lego domain logic: 48x32 board geometry, 16 colors, 8 shapes, collisions, and clear permissions. |
| `lego/lego.service.ts` | Lego board in-memory caching, debounced DB persistence (400ms), and throttled office broadcasts (300ms). |
| `lego/lego.game.ts` | Lego session instance handling place/remove/clear actions, role lookups, and per-user budgets. |
| `lego/lego.controller.ts` | REST controller serving `GET /workspace/lego` to discover active and saved Lego boards. |
| `lego/lego.module.ts` | NestJS module registering Lego with `GamesRegistry`. |

### Web (`apps/web/features/games/`)

| File | One-line job |
| --- | --- |
| `types.ts` | Shared frontend type definitions (`GameKind`, `GamePanelProps`, `LeaderboardEntry`, `LeaderboardResponse`). |
| `registry.ts` | Registry mapping game kinds to lazy dynamically imported UI panel components (`next/dynamic`). |
| `GameHost.tsx` | Full-screen modal host portal triggered by office `object:interact`, handling Escape and header display. |
| `GameHostHeader.tsx` | Modal top bar rendering game title, live player/spectator counts, leaderboard toggle, and close button. |
| `GameChrome.tsx` | React Context allowing mounted game panels to push player/spectator counts to `GameHostHeader`. |
| `useGameSession.ts` | React networking hook managing socket subscriptions, RAF state throttling, action dispatch, and lifecycle. |
| `Leaderboard.tsx` | Leaderboard drawer fetching weekly stats via REST each time it is opened (it is unmounted while closed). |
| `foosball/FoosballPanel.tsx` | Foosball panel composing audio synthesis, lobby seating controls, HUD, and table canvas. |
| `foosball/FoosballTable.tsx` | Interactive table container rendering scores, rod switcher buttons, pointer lock hints, and rematch controls. |
| `foosball/FoosballCanvas.tsx` | Canvas element executing foosball rendering routines. |
| `foosball/FoosballLobby.tsx` | Pre-match lobby displaying Blue (A) and Red (B) team seats and Start match button. |
| `foosball/FoosballEnded.tsx` | Game over banner displaying match winner, forfeit status, and rematch button. |
| `foosball/useFoosballMouse.ts` | Hook translating mouse movement into rod aim offsets, pointer lock, flick kicks, and click kicks. |
| `foosball/foosballPointer.ts` | Coordinate translations, rod offset computations, and network aim throttle logic. |
| `foosball/foosballKick.ts` | Pointer velocity analysis detecting rapid flick kicks and click kick power. |
| `foosball/foosballDraw.ts` | HTML5 Canvas 2D rendering routines for foosball field, lines, rods, players, and ball. |
| `foosball/constants.ts` | Foosball dimensions, field offsets, default view, and action types. Mirrors `apps/api/src/games/foosball/foosball.physics.ts` geometry. |
| `uno/UnoPanel.tsx` | Uno screen router switching between lobby, playing table, and game ended screens. |
| `uno/UnoTable.tsx` | Playing screen rendering opponents, center draw/discard piles, active hand, game log, and actions. |
| `uno/UnoLobby.tsx` | Pre-game player roster, spectator list, and host Start button. |
| `uno/UnoHand.tsx` | Player hand fan displaying card graphics, playable highlights, and click handlers. |
| `uno/UnoCard.tsx` | Visual card component rendering Uno colors and symbols. |
| `uno/UnoOpponents.tsx` | Seated opponent avatar cards with hand size indicators and turn badges. |
| `uno/UnoColorPicker.tsx` | Color picker modal displayed when playing wild or wild draw-four cards. |
| `uno/UnoEnded.tsx` | Match outcome screen displaying winner, final log, and host Play Again button. |
| `uno/constants.ts` & `uno/types.ts` | Uno styling tokens, pile constants, action types, and client view types. |
| `lego/LegoPanel.tsx` | Lego wall panel assembling toolbar, palette, baseplate canvas, error banner, and shortcuts footer. |
| `lego/LegoBoardCanvas.tsx` | HTML5 canvas rendering the 48x32 stud baseplate and handling placement/deletion pointer events. |
| `lego/useLegoBoard.ts` | Lego session hook managing selected shape, orientation (R key), color, erase mode, and cell sizing. |
| `lego/LegoToolbar.tsx` | Toolbar for selecting brick dimensions, rotating, toggling eraser, and clearing board. |
| `lego/LegoPalette.tsx` | 16-color swatch palette selector. |
| `lego/LegoSync.tsx` | Background listener updating office avatar sprite cache when `lego:art` broadcasts arrive. |
| `lego/legoBoardGeometry.ts` | Stud coordinate translations, responsive cell size calculations, and hex conversions. |
| `lego/legoCanvasRenderer.ts` | Canvas 2D rendering engine drawing studs, placed bricks, and placement hover outlines. |
| `lego/legoConstants.ts` | Board dimension constants (48x32), palette hex values, default shapes, and timings. |

## How it works

### Session lifecycle & flow diagram

1. **Interaction**: Player walks within 4 tiles of furniture. Office `Interactions` system emits `object:interact`.
2. **Mount**: `GameHost` captures the event, requests fullscreen, and mounts the game panel via `GAME_PANELS`.
3. **Join**: The panel's `useGameSession` emits `game:join`. `GamesGateway` checks action budget (60/s), verifies the furniture exists and matches `def.furnitureKind`, and confirms the player is within `JOIN_PROXIMITY_TILES = 4`.
4. **Session Binding**: `GamesSessionManager` adds the player to `GameSession` (instantiating the session via `def.create(ctx)` if first). The player joins the Socket.IO room `game:{workspaceId}:{objectId}`.
5. **State Broadcast**: `GameSession.emitState()` invokes `instance.view(userId)` individually for each participant and sends `game:state`.
6. **Interaction**: Player inputs trigger `send(action)` -> `game:action`. `GamesGateway` forwards to `GameSession.action()` -> `instance.onAction()`.
7. **Proximity Sweeps**: Every 1000ms, `sweepProximity()` checks player distances. Walking beyond `LEAVE_PROXIMITY_TILES = 7` ejects the player with `reason: 'far'`.
8. **Teardown**: On departure or modal close, `game:leave` is emitted. If participants reach zero, `session.dispose()` cleans up physics loops and timers immediately.

```
[Office Avatar] --(walks near furniture)--> [Interactions System]
      |                                              |
      | (presses E)                                  | (object:interact)
      v                                              v
[GameHost Portal] <----------------------------------+
      |
      | (mounts panel)
      v
[useGameSession] --(game:join)--> [GamesGateway]
                                         |
                                         | (checks budget, kind, proximity <= 4)
                                         v
                              [GamesSessionManager]
                                         |
                                         | (creates / joins)
                                         v
                                   [GameSession]
                                   /           \
                 (instance.onJoin)              (instance.view(userId))
                        v                                v
                 [GameInstance] -------------> [game:state to Socket]
```

### Framework contract (`GameInstance` hooks)

Concrete engines implement `GameInstance` (`apps/api/src/games/game.types.ts`):

- `onJoin(p: GamePlayerRef, intent: unknown): void`: Called by `GameSession.join()`. Game assigns seat/team or flags as spectator.
- `onLeave(userId: string, reason: 'left' | 'far' | 'disconnected'): void`: Called by `GameSession.leave()`. Differentiates intentional exit vs spatial drop vs network failure to allow grace periods or immediate forfeits.
- `onAction(userId: string, action: unknown): void`: Called by `GameSession.action()`. Validates and executes moves; throws `GameError` on illegal actions.
- `view(userId: string): unknown`: Called by `GameSession.emitState()` per participant to project customized state (masking hidden information).
- `dispose(): void`: Called by `GameSession.dispose()`. Clears all physics intervals, timers, and active loops.

The host framework supplies `GameContext` to `GameInstance`:
`participants()`, `emitState()`, `emitEvent(event, data, only)`, `record({ winners, losers })`, and `close()`.

### Socket events table

| Event name | Direction | Payload | Who receives | Handling file |
| --- | --- | --- | --- | --- |
| `game:join` | Client -> Server | `{ game: GameKind, id: string, intent?: unknown }` | Server namespace `/office` | `games.gateway.ts` |
| `game:leave` | Client -> Server | `{ id: string }` | Server namespace `/office` | `games.gateway.ts` |
| `game:action` | Client -> Server | `{ id: string, action: unknown }` | Server namespace `/office` | `games.gateway.ts` |
| `game:state` | Server -> Client | `{ id: string, game: GameKind, state: unknown }` | Target user socket | `useGameSession.ts` |
| `game:event` | Server -> Client | `{ id: string, event: string, data?: unknown }` | Room or target users | `useGameSession.ts` |
| `game:left` | Server -> Client | `{ id: string, reason: 'left' \| 'far' \| 'disconnected' \| 'closed' }` | Target user socket | `useGameSession.ts` |
| `game:ended` | Server -> Client | `{ id: string, result?: unknown }` | Each seated player (`sendToUser`), only when a session is force-closed (`result.reason: 'closed'`); a normal match end is a `game:state` with `phase: 'ended'` instead | `useGameSession.ts` |
| `game:error` | Server -> Client | `{ id?: string, code: string, message: string }` | Target user socket | `useGameSession.ts` |
| `lego:art` | Server -> Client | `{ id: string, bricks: Brick[] }` | Workspace room broadcast | `LegoSync.tsx`, `FurnitureSprites.ts` |

### Proximity & leave rules

- **Hysteresis**: `JOIN_PROXIMITY_TILES = 4` vs `LEAVE_PROXIMITY_TILES = 7` (Euclidean distance: `Math.hypot(avatarPx.x/16 - furnX, avatarPx.y/16 - furnY)`). Hysteresis prevents rapid join/leave flapping at the boundary.
- **Proximity Sweeps**: `GamesSessionManager.sweepProximity()` runs every 1000ms (`PROXIMITY_SWEEP_INTERVAL_MS`). If an avatar moves > 7 tiles away or cannot be located, the user is ejected with `reason: 'far'`.
- **Single Active Game**: `userActiveSession` guarantees a user can participate in only one minigame at a time; joining a new game automatically leaves the former with `reason: 'left'`.
- **Disconnects**: Gateway `handleDisconnect` notifies sessions with `reason: 'disconnected'`.
- **Empty Rooms**: When participants drop to 0, `GameSession` disposes immediately.

### Results & leaderboard

- **Recording**: Games trigger `ctx.record({ winners: string[], losers: string[] })`, persisted to `GameResult` table in PostgreSQL by `GameResultsService`. Forfeit: leaver = loser in both games (in Foosball, a team abandoning/timing out yields a forfeit loss; in Uno, a player leaving mid-game leaving fewer than 2 players ends the match and the leaver is recorded as the loser).
- **Aggregation**: `aggregateLeaderboard()` aggregates rows over a query window (default 7 days). Each match gives 1 win/game to unique winners and 1 loss/game to unique losers (a player in both gets 1 win, 1 loss, 1 game). Sorted by `wins desc`, `losses asc`, `games desc` (top 10).
- **REST & Real-time**: `GET /workspace/games/leaderboard` returns ranked entries with user names and avatar characters. `Leaderboard.tsx` fetches once when the drawer opens; there is no live refresh (the server has no "match recorded" event), reopening the drawer shows the new result.

## Rules & invariants

1. **Flood Protection**: Sockets are rate-limited to 60 events/second (`GATEWAY_ACTION_BUDGET_PER_SEC = 60`) via `Budget`. Lego enforces an additional 15 actions/sec per user (`ACTION_RATE_LIMIT_PER_SEC = 15`).
2. **Authoritative State & Zero Leakage**: Engines simulate game state entirely server-side. Private data (opponent cards) is stripped inside `instance.view(userId)` before transmission.
3. **Furniture Kind Verification**: Clients cannot join a game at mismatched furniture (`foosball` -> `foosball`, `uno` -> `cardTable`, `lego` -> `legoBoard`).
4. **Deterministic Teardown**: Disposing a session halts all physics intervals, timers, and callbacks, preventing memory leaks and orphaned loops.
5. **Cached Layout Access**: Layout queries use a 10s TTL cache (`LAYOUT_CACHE_TTL_MS = 10000`) in `GamesSessionManager` to avoid database pressure during 1-second proximity sweeps.

## Games

### Foosball

- **Rules**: 1v1 or 2v2 table soccer. First to 5 goals (`TARGET = 5`) wins. Phases: `lobby` -> `countdown` (3s) -> `playing` -> `goal` (1.5s reset) -> `ended`. Requires equal team counts to start (1v1 or 2v2). If an entire team disconnects or walks away during an active match, a 10-second grace timer (`GRACE_MS = 10000`) starts; failing to return results in a forfeit loss.
- **Controls & Keybinds**:
  - Mouse Y movement: Aims the active rod up/down (`AIM_THROTTLE_MS = 33`, delta > 0.15).
  - Left click on canvas: Locks pointer (`requestPointerLock`) and triggers kick swing (or switches to rod if clicked near another).
  - Rapid mouse flick: Triggers high-velocity flick kick (`detectFlickKick`).
  - Rod selection: Click HUD rod buttons (1–4) or click near rod columns on the table.
- **State & View**: `FoosballView` contains `phase`, `score` (`A`, `B`), `seats` (`A`, `B`), `spectators`, `you` (`{ side, rods }`), `ball` (`x`, `y`, `vx`, `vy`), `rods` (`{ y, kick }` per team), `countdown`, `winner`, `forfeit`, `graceLeft`, `now`.
- **Physics Engine**: Pure deterministic 2D simulation (`foosball.physics.ts`). Field is 120 x 64 units. Runs at 30 Hz with 4 substeps per tick to eliminate ball tunneling. Features elastic wall bounces (`WALL_RESTITUTION = 0.9`), men collision circles, kick impulses (base 150 units/s deflected by contact offset angle), and an automatic 6s unstuck impulse.
- **Pitch Geometry Mirror**: `apps/web/features/games/foosball/constants.ts` mirrors `apps/api/src/games/foosball/foosball.physics.ts` pitch dimensions (`FIELD_L`, `FIELD_W`, `GOAL_W`, `BALL_R`, `MAN_R`), rod positions (`ROD_X_A`, `ROD_X_B`), rod travel limits, and man Y offsets; change both together.

### Uno

- **Rules**: 2 to 6 players (`MIN_PLAYERS = 2`, `MAX_PLAYERS = 6`). Standard 108-card deck. Players match top card color or number/action. Wild cards require choosing a color. Stacking is supported: `+2` stacks on `+2`, `wild4` stacks on `wild4`. Reverse with 2 players acts as a Skip. Hand <= 2 cards enables the `UNO!` call; failing to call before playing down to 1 card leaves the player vulnerable to being `caught` (+2 card penalty). Leaving mid-game with fewer than 2 players forfeits the match (forfeit: leaver = loser in both games).
- **Controls & Keybinds**:
  - Click card in hand: Plays card (opens `UnoColorPicker` if Wild/Wild4).
  - Click Deck button: Draws 1 card (or draws accumulated stacked penalty).
  - Click `Pass`: Voluntary turn pass after drawing an unplayable card.
  - Click `UNO!`: Calls Uno when holding <= 2 cards.
  - Click `Catch!`: Punishes vulnerable opponent who failed to call Uno.
- **State & View**: `UnoView` contains `phase`, `hostId`, `role` (`player` | `spectator`), `hand` (only your cards), `players` (names, avatar, card count, saidUno), `spectators`, `turnId`, `direction` (1 | -1), `top` card, `currentColor`, `drawPile` count, `pendingDraw`, `pendingKind`, `drewCardId`, `playable` card IDs, `vulnerableId`, `winnerId`, and `log`.
- **Engine Notes**: Pure rules engine in `uno.rules.ts` (deck generation, legal moves, scoring, deals); socket orchestration and session dispatch in `uno.game.ts`. Discard pile reshuffled into draw pile if exhausted.

### Lego

- **Rules**: Persistent, collaborative 48x32 stud building wall (`BOARD_W = 48`, `BOARD_H = 32`). 16 palette colors (0–15). 8 allowed brick footprints (`[1,1]`, `[1,2]`, `[2,1]`, `[2,2]`, `[1,4]`, `[4,1]`, `[2,4]`, `[4,2]`). Overlapping or out-of-bounds placements are rejected. Only workspace `OWNER` or `ADMIN` can clear the entire board (`canClearBoard`).
- **Controls & Keybinds**:
  - Left click on baseplate: Places selected brick shape with active color.
  - Right click or Shift + Left click: Erases brick under cursor.
  - `R` / `r` key: Toggles brick rotation (swaps width and height).
  - Toolbar buttons: Select base shape, toggle rotation, toggle eraser mode, or clear board.
- **State & View**: `LegoState` contains `ready`, `w: 48`, `h: 32`, `bricks: Brick[]` (`[x, y, w, h, colorIndex]`), `canClear`, `players`, `version`.
- **Engine Notes**: Stored as single JSON array in Prisma `LegoBoard`. Mutations update an in-memory cache, schedule a 400ms debounced database save (`SAVE_DEBOUNCE_MS = 400`), and schedule a 300ms throttled office-wide WebSocket broadcast (`BROADCAST_THROTTLE_MS = 300`) on `lego:art` so world sprites update in real-time.

## Why it's built this way

- **Hysteresis proximity (4 tiles join vs 7 tiles leave)**: Prevents edge-jitter where small movements near the threshold trigger rapid join/leave cycles.
- **Per-viewer state projection (`instance.view(userId)`)**: Ensures private information (e.g. Uno hands, hidden decks) never crosses network boundaries, preventing client-side inspection exploits.
- **Dynamic in-memory registry (`GamesRegistry`)**: Decouples core routing and gateways from specific game logic; game submodules register via `onModuleInit` without editing core gateway files.
- **Immediate zero-participant disposal**: Zero-participant sessions are destroyed immediately to free memory and terminate active 30 Hz physics loops or intervals.
- **Layout caching in `GamesSessionManager`**: Caching layouts for 10 seconds prevents querying PostgreSQL during 1-second proximity sweeps.
- **Physics substepping (4 steps / tick)**: Advances ball and rod positions in sub-increments to prevent tunneling of high-speed balls through player paddles and walls.
- **Client RAF + timeout throttle**: The server transmits state up to ~30 Hz. Rendering every packet causes React render cascades; `requestAnimationFrame` matches display refresh rates, while a 100ms fallback timeout flushes queued frames in background tabs.
- **Debounced JSON persistence for Lego**: Single JSON column upserts with 400ms debouncing absorb high-frequency clicks during building bursts while guaranteeing eventual persistence.
- **Dynamic component imports (`next/dynamic`)**: Game panels load canvas renderers, physics math, and audio; dynamic loading keeps initial bundle sizes lean.

## How to change it safely

### Step-by-step: Adding a new minigame

To add a new minigame (e.g. `'chess'`):

1. **Update API Core Types** (`apps/api/src/games/game.types.ts`):
   - Add `'chess'` to `GameKind`.
   - If introducing a new furniture item, add `'chessTable'` to `FurnitureKind`.
2. **Implement Pure Game Rules** (`apps/api/src/games/chess/chess.rules.ts`):
   - Define board state, move legality, and win conditions without I/O or websockets.
3. **Implement Game Instance Wiring** (`apps/api/src/games/chess/chess.game.ts`):
   - Export factory function (e.g. `createChessGame(ctx: GameContext): GameInstance`).
   - Implement `onJoin`, `onLeave`, `onAction`, `view`, and `dispose`.
4. **Create NestJS Module** (`apps/api/src/games/chess/chess.module.ts`):
   - Create `@Module({ imports: [GamesCoreModule] })`.
   - In `onModuleInit`, inject `GamesRegistry` and call `this.registry.register({ kind: 'chess', furnitureKind: 'chessTable', create: createChessGame })`.
5. **Register in Root Games Module** (`apps/api/src/games/games.module.ts`):
   - Add `ChessModule` to the `imports` array of `GamesModule`.
6. **Update Web Core Types** (`apps/web/features/games/types.ts`):
   - Add `'chess'` to frontend `GameKind`.
7. **Create Web UI Panel** (`apps/web/features/games/chess/ChessPanel.tsx`):
   - Accept `GamePanelProps`.
   - Consume `useGameSession<ChessView>(socket, 'chess', objectId)`.
   - Report roster counts via `useGameChromeInfo`.
8. **Register Web Component** (`apps/web/features/games/registry.ts`):
   - Add entry to `GAME_PANELS`: `chess: dynamic(() => import('./chess/ChessPanel'))`.
9. **Wire Office Interaction** (`apps/web/game/systems/Interactions.ts` & `GameHost.tsx`):
   - Map furniture kind `chessTable` to interaction target `{ type: 'chess', ... }` in `Interactions.ts`.
   - Verify `GameHost.tsx` permits `'chess'` in `officeEvents.on('object:interact')`.

## Tests

### Test specifications

- `games.session.spec.ts`: Tests `GamesSessionManager` and `GameSession` lifecycle, join/leave, single-session-per-user enforcement, proximity sweeps, and disposal.
- `proximity.spec.ts`: Tests `distanceInTiles` and `isWithinProximity` coordinate math and tile threshold bounds.
- `game-results.service.spec.ts`: Tests `aggregateLeaderboard` deduplication, sorting rules (wins desc, losses asc, games desc), and `GameResultsService.leaderboard` database queries.
- `foosball/foosball.physics.spec.ts`: Tests deterministic 2D kinematics, rod clamping, wall bounces, collisions, kick triggers, and goal detection.
- `foosball/foosball.game.spec.ts`: Tests foosball room phases, seating rules, disconnect grace period forfeit, and action handlers.
- `uno/uno.rules.spec.ts`: Tests pure Uno rules: deck generation, legal move validation, draw penalty stacking (+2, +4), 2-player reverse as skip, and scoring.
- `uno/uno.spec.ts`: Tests Uno session lifecycle, spectator vs player roles, turn cycling, Uno call/catch vulnerabilities, and match outcome persistence.
- `lego/lego.rules.spec.ts`: Tests Lego geometry rules: bounds checking, valid dimensions, collision/overlap detection, and clear permissions.
- `lego/lego.spec.ts`: Tests `LegoService` (caching, debounced persist, throttled broadcast), `LegoGameInstance` (actions, budgets, permissions), and `LegoController`.

### Running the tests

Run the complete API test suite within the Docker container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api pnpm test
```

To run a specific test file:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T api pnpm test src/games/foosball/foosball.physics.spec.ts
```

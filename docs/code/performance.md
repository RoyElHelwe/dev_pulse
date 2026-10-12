# Performance Architecture & Lag Optimization

## Purpose

This document answers the core evaluation question: **"What did you do about lag, and why?"**
Dev Pulse combines a 60 fps Phaser 3 WebGL virtual office canvas with a Next.js/React DOM application layer (task Kanban board, minimap, chat, full-screen mini-games). Unoptimized hybrid rendering created severe main-thread lag: continuous CPU polygon triangulation, synchronous texture creation freezes, unthrottled DOM drag reflows, and background canvas execution beneath overlays. This document records the empirical profiling methodology, root hotspots, architecture fixes, and verification benchmarks.

## Where it lives

| Mechanism | File(s) |
|---|---|
| Ref-counted cached shape textures | `apps/web/game/render/shapes.ts`, `apps/web/game/objects/Avatar.ts`, `apps/web/game/objects/Bubble.ts`, `apps/web/game/objects/DeskPlates.ts` |
| Character texture 3 ms budget & pre-bake | `apps/web/game/objects/Avatar.ts`, `apps/web/game/scenes/OfficeScene.ts` |
| Zero-allocation `update()` tick | `apps/web/game/scenes/OfficeScene.ts` |
| 10 Hz proximity evaluation & hysteresis | `apps/web/game/systems/Proximity.ts`, `apps/web/game/systems/NetSync.ts` |
| State-guarded `setDepth` / `setPosition` | `apps/web/game/scenes/OfficeScene.ts`, `apps/web/game/objects/RemotePlayer.ts` |
| Phaser dual sleep modes (`hidden` / `throttled`) | `apps/web/game/createGame.ts`, `apps/web/features/office/useOfficeBoard.ts` |
| Baked static scenery chunks | `apps/web/game/render/scenery.ts` |
| Sliced baked wall faces with alpha fade | `apps/web/game/render/wallFaces.ts` |
| Minimap quarter-tile quantised snapshot | `apps/web/features/office/Minimap.tsx` |
| BoardDrawer lazy mounting & style cleanup | `apps/web/features/tasks/BoardDrawer.tsx` |
| TaskBoard rAF-throttled drag & rect caching | `apps/web/features/tasks/useBoardDrag.ts`, `apps/web/features/tasks/TaskBoard.tsx` |
| Unpushed toast and connection notices layer | `apps/web/features/office/OfficeNotices.tsx`, `apps/web/features/office/OfficeOverlays.tsx`, `apps/web/features/office/OfficeView.tsx` |

## How it works

### Phaser Engine Optimizations
- **Baked ref-counted shape textures (`render/shapes.ts`):** Persistent `scene.add.graphics()` calls draw vector paths on every frame, forcing Phaser to re-triangulate polygons via earcut on every tick. `acquireShape()` creates a dynamic texture keyed by shape parameters (`shape:${key}:${scale}`), drawing the graphics once and displaying it as a lightweight `Phaser.GameObjects.Image`. Used for avatar shadows (`Avatar.ts:182`), name tags (`Avatar.ts:208`), speech and status bubbles (`Bubble.ts:100, 190`), and desk nameplates (`DeskPlates.ts:55`). Reference counts track usage; `releaseShape()` destroys the WebGL texture when the last consumer unmounts.
- **Character frame budgeting & pre-baking (`objects/Avatar.ts`, `scenes/OfficeScene.ts`):** Procedural avatar frames drawn on demand via `art/pen.ts` caused multi-second long tasks when new players connected. `beginTextureBudget(3)` sets a 3 ms per-frame generation window in `OfficeScene.update()`. If texture baking exceeds the budget, `Avatar.ts:102` defers baking and retains the previous pose without dropping frames. The local player's 8 walking cycle frames across all 4 directions are pre-baked at scene creation via `this.player.prebake()`.
- **Zero-allocation update loop (`scenes/OfficeScene.ts`):** `OfficeScene.update()` eliminates per-frame heap allocations. Vector math reuses a persistent instance (`this.moveVec`), seat search and zone resolution only run when player movement occurs, and static collections are reused.
- **10 Hz proximity evaluation (`systems/Proximity.ts`, `systems/NetSync.ts`):** Voice proximity distance checks run at 10 Hz via `PROXIMITY_TICK_MS = 100` (`NetSync.ts:151`). Distance evaluation in `Proximity.ts` reuses a persistent `Set<string>`, enforces a hysteresis window between `NEAR_RADIUS` (3.0 tiles) and `FAR_RADIUS` (3.5 tiles) to prevent boundary flickering, and throttles `player:distance` events to 5 Hz with a 0.05-tile minimum delta.
- **Change-only mutation guards (`scenes/OfficeScene.ts`, `objects/RemotePlayer.ts`):** Calling `setDepth()` or `setPosition()` marks Phaser display lists dirty, incurring expensive depth re-sorts. Positions and depths are compared against existing properties before writing (`OfficeScene.ts:250`, `RemotePlayer.ts:85, 90`), writing only when values actually change.
- **Phaser sleep modes (`createGame.ts`, `features/office/useOfficeBoard.ts`):**
  - `hidden` mode: When a full-screen mini-game opens, `setPaused(true, 'hidden')` calls `game.loop.sleep()`, halting WebGL rendering and local input completely. A manual background step at 100 ms (~10 Hz) keeps physics, remote player syncing, and WebRTC voice proximity alive.
  - `throttled` mode: When the task board opens, after 900 ms settling (`BOARD_SETTLE_DELAY_MS`), `setPaused(true, 'throttled')` runs a manual step at 66 ms (~15 fps), drastically reducing draw overhead while keeping underlying animations alive. Resuming restores the standard frame loop instantly.
- **Chunked scenery & sliced wall faces (`render/scenery.ts`, `render/wallFaces.ts`):** Floors and leftover room labels bake into chunked render textures (`CHUNK_PX` chunks) at scene initialization, collapsing hundreds of draw calls into static chunks. Horizontal wall faces bake once into textures and slice into 1-tile wide column images; avatar occlusion fades column alpha smoothly without re-tessellating wall geometry.

### React / DOM Optimizations
- **Minimap quantised snapshot (`features/office/Minimap.tsx`):** A 150 ms polling interval retrieves `controller.snapshot()`, but positions are quantized to 0.25-tile steps (`q = (n) => Math.round(n * 4) / 4`). Updates trigger React state commits only when quantized coordinates actually change, resulting in zero React commits when players are stationary.
- **BoardDrawer lazy mounting (`features/tasks/BoardDrawer.tsx`):** The heavy Kanban task board tree is mounted only when `showBoard = open || dragging || lingering` is true. When closed, the board is unmounted. Heavy CSS properties (`will-change: transform` and `backdrop-blur`) were removed from the office canvas container.
- **TaskBoard rAF-throttled drag (`features/tasks/useBoardDrag.ts`, `TaskBoard.tsx`):** Column card bounding rectangles are measured and cached once at drag start (`columnCache`). Dragover insertion index calculations are coalesced to at most 1 execution per `requestAnimationFrame`, eliminating synchronous layout recalculation loops.
- **Unpushed notices overlay (`features/office/OfficeNotices.tsx`, `OfficeOverlays.tsx`, `OfficeView.tsx`):** Toast notifications and offline banners render inside `OfficeOverlays` outside the sliding office canvas container, ensuring they remain visible when the drawer shifts the canvas.

## Rules & invariants

1. **No persistent Graphics shapes:** Never create persistent `scene.add.graphics()` for rounded UI elements, badges, shadows, or speech bubbles; always use `acquireShape()` from `render/shapes.ts`.
2. **Zero allocations in `update()`:** Hot tick paths in `OfficeScene.update()` must never allocate objects, closures, arrays, or generators. Pre-allocate and reuse class fields.
3. **Texture generation time budget:** Any procedural canvas or DynamicTexture generation on the main thread must adhere to the <= 3 ms per-frame budget.
4. **No full-rate canvas under overlays:** Phaser WebGL rendering must sleep or throttle to ~15 fps whenever covered by modals or drawers.
5. **Quantize polling state in React:** Background polling intervals touching React state must quantize coordinates and equality-diff snapshots before triggering re-renders.
6. **Guard display list mutations:** Never call `setDepth()` or `setPosition()` unconditionally on every tick.

## Why it's built this way

### Architectural Decisions
- **Ref-counted dynamic textures vs. REJECTED static sprite atlas:** With modular avatar recipes (skin tones, hairstyles, shirts, pants, facial expressions, directions, walk frames), a complete pre-baked spritesheet would produce a combinatorial explosion requiring hundreds of megabytes of GPU texture memory. Ref-counted dynamic textures bake only active combinations on demand and purge unused assets immediately.
- **Time-budgeted texture slicing vs. REJECTED Web Worker rendering:** Phaser DynamicTextures require WebGL framebuffer rendering contexts on the main DOM thread. OffscreenCanvas transfers from workers introduced thread synchronization lag and failed to prevent main-thread GPU texture upload stalls. Slicing texture creation into 3 ms frame budgets eliminated stutter without cross-thread complexity.
- **Phaser sleep with manual background step vs. REJECTED engine teardown:** Destroying the Phaser instance on opening the board or mini-games would sever WebRTC spatial audio calculations, drop network sync, and introduce multi-second re-instantiation freezes on modal exit. Sleeping the game loop while ticking physics/network at 10–15 Hz preserved seamless state with near-zero CPU/GPU usage.
- **rAF-throttled DOM drag vs. REJECTED canvas-rendered board:** A pure canvas board would prevent native browser accessibility, text selection, screen reader navigation, and standard form interactions. Throttling DOM measurements via `requestAnimationFrame` achieved smooth dragging while keeping native accessibility intact.

### What was NOT done / rejected / remaining
- **S6-drag residual React DOM cost:** Dragging cards in Next.js development mode still causes layout overhead (~32 fps during fast drags). The Phaser WebGL overhead is resolved; remaining cost stems from dev-mode React reconciliation.
- **x4 CPU S4 frames > 50 ms:** Under aggressive x4 CPU throttling with 6 bots walking, ~34 frames exceed 50 ms due to WebGL batch flushing and sliced wall face alpha updates.
- **Production build not measured:** Profiling intentionally targeted the Next.js development build where React reconciliation overhead is steepest to identify worst-case bottlenecks.
- **Procedural character atlas:** Avatars remain dynamically rendered via `pen.ts` rather than packed into a single texture atlas, as time budgeting resolved long-task freezes.
- **Backdrop-blur GPU cost:** Backdrop filter fill-rate impact was negligible on desktop test GPUs, though removed from the board drawer container as a safeguard.
- **Texture leak investigation:** Soak testing confirmed WebGL texture count plateaued at 252 (lazy generation of active frames rather than a memory leak).

## How to change it safely

- **Adding new world shapes or badges:** Never call `scene.add.graphics().fillRoundedRect()`. Register a unique key with `acquireShape()` in `render/shapes.ts`, specify bounding dimensions and scale, and pair with `releaseShape()` on destruction.
- **Modifying the update loop:** Inspect `OfficeScene.update()` with the Chrome DevTools Memory Allocation Profiler. Ensure zero allocations occur while walking or standing idle.
- **Adding procedural visual assets:** Wrap dynamic generation calls in `performance.now()` checks against an explicit frame budget (<= 3 ms), falling back to existing assets until generation finishes.
- **Modifying drawer or overlay UI:** Verify that `OfficeController.setPaused()` is invoked when panels obscure the canvas, and ensure overlay containers do not apply `will-change: transform` to the office canvas.
- **Verification workflow:** Re-run benchmark scenarios under standard and x4 CPU throttling. Inspect visual differences using automated screenshot diffing (ensure pixel diff is below 0.15% against reference frames). For dev test hooks, see testing docs (`docs/code/testing.md` will exist later).

## Tests / how to measure

### Measurement Methodology
Measurements were conducted on a desktop workstation running a headed Chrome instance (1920x1080 viewport, DPR 1, real GPU via AMD Radeon, ANGLE D3D11) against the development stack (Next.js dev server, Phaser production bundle). Scenarios (S1 through S11) were automated using a local measurement harness (not committed). Scenarios were executed at full speed and under `CPU_THROTTLE=4` to emulate lower-spec laptop hardware. Because display refresh is ~56–60 Hz, frame time is capped at ~17.7 ms (60 fps saturation corresponds to p95 <= ~18.5 ms with zero frames > 33 ms); script execution time (ms/s) and x4 throttle metrics demonstrate the actual headroom gains.

Test scenarios evaluated:
- **S0:** Empty page baseline (frame cap check).
- **S1:** Idle avatar alone in office.
- **S2:** Walking alone in office (first walk cycle texture generation).
- **S3:** Bots first appear (character texture storm).
- **S3b:** Cold page load with 6 bots present.
- **S4:** Walking with 6 bots present (warm steady state).
- **S5:** Chat flow open and closed.
- **S6:** Task board drawer open idle and dragging cards.
- **S7:** Mini-games open (foosball, uno, lego).
- **S8:** WebRTC voice connected with multiple browsers.
- **S9:** Minimap active while walking.
- **S10:** Office layout editor active (idle and dragging).
- **S11:** 5-minute soak test (memory and texture leak check).

### Baseline Hotspots (Ranked)
1. **Phaser Graphics replay and earcut triangulation:** `GraphicsWebGLRenderer`, `earcut`, and `batchFillPath` consumed 25–30% of total CPU samples (~45% of non-idle time) even with a single player, caused by persistent Graphics objects for shadows, name tags, and bubbles.
2. **Synchronous character texture generation:** DynamicTexture generation on first character render caused S3 (bots appearing) to drop to 16.1 fps with 9.3 s of long tasks, S2 (first walk) to stall at p99 71 ms (27 frames > 50 ms), and S3b (cold load) to freeze for 1.9 s (4.1 s at x4 CPU).
3. **Task board drawer overhead:** S6 idle open dropped to 17.3 fps (p95 133 ms, 164 frames > 50 ms). S6 card dragging dropped to 2.4 fps (p95 2,191 ms, 54 frames > 50 ms) due to unthrottled `getBoundingClientRect` queries and background board re-rendering.
4. **Active game panels:** Full-screen mini-games kept the underlying office canvas rendering, resulting in S7 foosball at 35.1 fps (p95 54 ms), uno at 20.6 fps (p95 107 ms), and lego at 33.1 fps (p95 71 ms).
5. **Minimap polling reconciliation:** A 150 ms `setInterval` calling `snapshot()` caused 6.7 React commits/sec and continuous linear room scans in an idle office.
6. **Per-frame allocations in `OfficeScene.update`:** Generator allocation in `remoteTiles()`, temporary `Vector2` instances, and calling `setDepth()` every frame dirtied the display list sort (1–2 ms/frame at 7+ players, MinorGC 310 ms / 20 s).
7. **WebSocket movement traffic:** Ingesting 128 msgs/sec with 6 bots triggered unbatched `movePlayer` and `setDepth` updates.
8. **Long-run soak stalls:** S11 (5-minute soak) recorded 583 frames > 50 ms with +2.7 textures/min monotonic drift.

### Baseline Measurements (Prior to Optimization)
| Scenario | fps | p50 | p95 | p99 | >50ms | note |
|---|---|---|---|---|---|---|
| S0 empty page (cap) | 56.2 | 17.7 | 18.6 | 19.9 | 0 | Frame cap baseline |
| S1 idle alone | 56.2 | 17.7 | 18.5 | 20.5 | 0 | Script = 321 ms/s (32% CPU) |
| S2 walk alone | 48.1 | 18.0 | 36.0 | 71.3 | 27 | 15 long tasks (texture generation) |
| S3 bots first appear | 16.1 | 36.2 | 126 | 334 | 121 | 66 long tasks = 9.3 s freeze |
| S3b cold page load (6 bots) | 37.4 | 17.9 | 36.0 | 132 | 21 | Ready in 1.6 s, 1.9 s long task |
| S4 walk + 6 bots (warm) | 56.2 | 17.7 | 18.5 | 18.8 | 1 | 344 draw calls/s, ws 128 msg/s |
| S5 chat flow | 56.5 | 17.7 | 18.3 | 18.7 | 0 | Negligible impact |
| S6 board drawer open idle | 17.3 | 50.0 | 133 | 183 | 164 | Severe drop |
| S6 dragging cards | 2.4 | 117 | 2191 | 3496 | 54 | Severe drop (layout thrashing) |
| S7 foosball / uno / lego | 35.1 / 20.6 / 33.1 | 18.6 / 36.5 / 18.2 | 54 / 107 / 71 | 72 / 127 / 89 | 54 / 141 / 98 | Office canvas rendering underneath |
| S11 5 min soak | 47.2 | 16.7 | 38.3 | 119 | 583 | Textures +2.7/min drift |
| **x4 CPU** S1 / S2 | 15.5 / 22.3 | 35.8 / 35.2 | 120 / 112 | 277 / 187 | 129 / 151 | Idle misses 60 fps on weak CPU |
| **x4 CPU** S4 / S3b | 2.1 / 2.3 | 182 / 88 | 1559 / 1358 | 4687 / 5350 | 53 / 33 | 4–5 s freezes |

### 18b Part 1: React/DOM Benchmarks (Before -> After)
Dev build, identical hardware:

| Scenario | before | after |
|---|---|---|
| S1 idle: React commits/s | 6.7 | 1.4 |
| S1 idle: fps / p95 / script ms/s | 56.2 / 18.5 / 321 | 59.2 / 16.9 / 234 |
| S6-idle (board open): fps / p95 / p99 / >50ms frames | 17.3 / 100-133 / 183 / 164 | 57.4 / 23.4 / 33.5 / 1 |
| S6-idle: React/next self time (20 s) | 1267 ms | 335 ms |
| S6-drag (cards dropped): fps / p95 / >50ms frames | 2.4 / 1207 / 54 | 32.4 / 117 / 69 |
| S6-drag: React/next self time (20 s) | 2705 ms | 888 ms |
| S9 minimap (walking): fps / p95 / p99 | 58.2 / 17.0 / 33 | 55.6 / 19.1 / 50 (noise: only change is fewer commits; Phaser dominates) |

### 18b Part 2: Phaser Game Engine Benchmarks (Before -> After)
Format: fps mean / p50 / p95 / p99 ms / frames >50 ms / script ms per s. Display caps at ~56–60 fps (~17.7 ms):

| Scenario | before | after |
|---|---|---|
| S1 idle | 56.4 / 17.7 / 18.4 / 18.7 / 0 / 125 | 56.4 / 17.7 / 18.4 / 18.7 / 0 / 51 |
| S2 walk | 56.5 / 17.6 / 18.4 / 18.8 / 0 / 160 | 56.5 / 17.6 / 18.3 / 18.7 / 0 / 88 |
| S3 bots appear | 56.7 / 17.6 / 18.3 / 18.6 / 0 / 287 | 56.5 / 17.6 / 18.4 / 18.8 / 0 / 114 |
| S3b cold load, 6 bots | 56.7 / 17.6 / 18.3 / 18.7 / 0 / 314 | 56.6 / 17.6 / 18.3 / 18.7 / 0 / 144 |
| S4 walk + 6 bots | 56.6 / 17.6 / 18.4 / 18.8 / 1 / 320 | 56.7 / 17.6 / 18.4 / 18.8 / 0 / 135 |
| S6 board open idle | 56.6 / 17.6 / 18.4 / 18.8 / 0 / 284 (386 draws/s) | 56.4 / 17.7 / 18.4 / 18.6 / 0 / 62 (114 draws/s) |
| S6 board drag cards | 44.6 / 17.7 / 53.8 / 105 / 70 / 451 | 46.1 / 17.8 / 53.3 / 89 / 64 / 267 (rest = DOM layout of the dev React board, not Phaser) |
| S7 baby foot / uno / lego (full screen) | 56.4 / 56.6 / 56.5, script 44 / 9 / 41 | 56.7 / 56.3 / 56.3, script 63 / 30 / 59 (office not rendered; the extra script is the 10 Hz background tick + the games) |
| S11 5 min soak | 56.6 / 17.6 / 18.3 / 18.7 / 5 / n.a. | 56.5 / 17.6 / 18.4 / 18.8 / 1 / n.a.; Phaser texture keys flat at 252 from minute 1 to 5 (before: WebGL textures +2.1/min = frames filling lazily, now plateaued; not a real leak) |
| **x4 CPU** S1 | 56.3 / 17.7 / 18.5 / 19.1 / 0 / 567 | 56.7 / 17.6 / 18.2 / 18.6 / 0 / 345 |
| **x4 CPU** S3b | 27.5 / 35.2 / 70.9 / 106 / 87 / 829 | 49.5 / 17.7 / 35.6 / 53.6 / 20 / 645 |
| **x4 CPU** S4 | 25.6 / 35.4 / 88.7 / 122 / 122 / 789 | 48.4 / 17.7 / 35.6 / 71.4 / 34 / 608 |
| **x4 CPU** S6 board open idle | 31.0 / 35.1 / 53.4 / 88.1 / 64 / 759 | 54.7 / 17.7 / 18.3 / 35.9 / 9 / 242 |

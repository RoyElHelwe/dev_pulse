# Office Game Engine & Renderer

## Purpose

The office game engine renders DevPulse's 2D virtual workspace in real time. It embeds a custom Phaser 3 canvas inside Next.js, displaying an interactive architectural floor plan with 3/4 perspective walls, procedural furniture, and animated employee avatars. The engine handles tile-based spatial navigation, collision physics, depth sorting, live layout editing, interactive equipment triggers (TVs, whiteboards, minigames), and spatial voice proximity calculations. It renders entirely procedurally without static image spritesheets, running at 60 FPS while scaling cleanly on high-DPI displays.

---

## Where it lives

The office game engine resides in `apps/web/game/` and integrates with React UI components under `apps/web/features/office/`.

| File | One-line Job |
| --- | --- |
| `constants.ts` | Global engine constants: tile metrics (32 px), player hull, zoom bounds, networking rates, seating limits, and depth bands. |
| `createGame.ts` | Factory bootstrapping Phaser, managing viewport resizing, throttled step loops, and exporting the `OfficeController` API. |
| `art/character.ts` | Procedural avatar graphics: 8-frame walk cycles, poses, moods, facial expressions, and clothing layers drawn via `Pen`. |
| `art/color.ts` | OKLCH color space conversions, perceptual lightness normalization, gamut clipping, and 0xRRGGBB integer packing. |
| `art/desk.ts` | Procedural desk clutter drawing: monitors, laptops, notebooks, mugs, and paper stacks styled to avatar aesthetic vibe. |
| `art/palette.ts` | Curated color ramps and palettes for skin tones, hair dyes, clothing textiles, trousers, and shoes. |
| `art/pen.ts` | Unified graphics abstraction decoupling draw recipes across Phaser Graphics, HTML5 2D Canvas, and SVG strings. |
| `art/recipe.ts` | Avatar configuration schema, randomized generator, and compact base-36 DNA string encoding/decoding. |
| `editor/catalog.ts` | Placeable furniture catalog definitions, default dimensions, palette categories, and UI label mappings. |
| `editor/EditMode.ts` | Phaser interactive input handler managing drag gestures, ghost item placement, rotation shortcuts, and selection marquee. |
| `editor/LayoutEditor.ts` | Headless editor state machine tracking furniture mutations, selection sets, placement rules, and undo/redo stacks. |
| `editor/rules.ts` | Fast client-side placement rule validator checking bounding limits, wall collisions, and overlap during drag gestures. |
| `layout/derive.ts` | Pure layout derivations computing runtime game zones (desks, meetings, lounges) and floor labels from layout state. |
| `layout/geometry.ts` | Client mirror of geometric bounds, desk seat coordinates, rectangle intersection, and reading-order desk sorting. |
| `layout/mount.ts` | Byte-for-byte mirror of backend wall-mounting rules, base line detection, and snapping to south-facing wall faces. |
| `layout/types.ts` | Frontend layout types mirrored from API contracts, plus client-specific `Zone` and `ZoneType` definitions. |
| `objects/Avatar.ts` | Local player avatar game object handling walk cycle animation, nameplates, drop shadows, headset status, and speech bubbles. |
| `objects/Bubble.ts` | Speech, status, and interaction prompt bubble display objects utilizing shared ref-counted cached textures. |
| `objects/DeskPlates.ts` | Workstation owner nameplate labels floating on desk edges, tinted emerald green for the local player. |
| `objects/RemotePlayer.ts` | Network player avatar entity buffering position snapshots and smoothly interpolating coordinates with a 100 ms delay. |
| `objects/RoomBadges.ts` | Meeting room occupancy and schedule badges mounted above glass and solid meeting room walls. |
| `render/draw.ts` | Canvas drawing primitives (rounded rectangles, circles, color shading) and deterministic seeded PRNG utilities. |
| `render/floors.ts` | Procedural floor pattern graphics rendering for oak planks, carpet tile grids, and speckled terrazzo chips. |
| `render/furniture.ts` | Procedural drawing recipes, solid flags, and layer specifications for all 21 furniture kinds in `FURNITURE`. |
| `render/legoArt.ts` | Lego stud grid data models, palette definitions, and canvas drawing routines for dynamic collaborative lego walls. |
| `render/scenery.ts` | Static scenery baking pipeline caching floors and room text labels into 512 px render textures. |
| `render/shapes.ts` | Ref-counted dynamic texture cache for avatar shadows, badges, and bubbles preventing repeated graphics tessellation. |
| `render/sprites.ts` | Dynamic texture cache and sizing math for furniture sprites, desk personalization, paper stacks, and drop shadows. |
| `render/wallFaces.ts` | Sliced 1-tile column wall face renderer with proximity alpha fading when characters walk behind solid walls. |
| `render/walls.ts` | 2.5D wall geometry calculations, physical collider bounds, front faces, skirting boards, and dark wall caps. |
| `scenes/OfficeScene.ts` | Core Phaser scene lifecycle coordinator managing physics, player locomotion, scenery, and subsystem delegation. |
| `systems/Depth.ts` | Render depth band constants and sorting formulas for floors, rugs, shadows, Y-sorted entities, badges, and hints. |
| `systems/FurnitureSprites.ts` | Placed furniture sprite manager handling dynamic textures, drop shadows, desk paper updates, and wall transparency syncing. |
| `systems/Interactions.ts` | Spatial interaction triggers and prompt bubbles for desks, task boards, TV screens, and minigames. |
| `systems/NetSync.ts` | Network movement dispatcher (50 ms cadence), remote avatar roster lifecycle, and proximity audio feeds. |
| `systems/Proximity.ts` | Spatial voice distance tracking with hysteresis (3.0 near, 3.5 far) and room containment checks. |
| `systems/RoomLocks.ts` | Solid collider manager for booked meeting rooms, enforcing lockout boundaries and evicting unauthorized players. |
| `systems/rooms.ts` | Spatial room query utility locating the enclosing room ID for given tile coordinates (smallest area wins). |
| `systems/Seating.ts` | Chair detection, dwell timers (500 ms), stand hold timers (500 ms), and directional step-off math. |
| `systems/ViewControl.ts` | Camera follow controller managing zoom limits, viewport tweening, and horizontal view shifting. |

---

## How it works

### 1. Boot sequence & OfficeController API

The office boots inside Next.js via `OfficeView.tsx`, which mounts `useOfficeConnection.ts`. Once the DOM container attaches and fonts load (`document.fonts.ready`), it dynamically imports `createGame.ts` to avoid server-side rendering issues and prevent font pop on text badges. `createGame()` configures Phaser with Arcade Physics, sets canvas dimensions scaled to device pixel ratio (`Math.min(window.devicePixelRatio, 2)`), attaches a `ResizeObserver` to handle dynamic container resizes, checks for test frame rate caps (`devFpsCap()`), and launches `OfficeScene`.

```
OfficeView.tsx ──> useOfficeConnection ──> createGame(parent, options)
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
           Phaser.Game                                                          OfficeController
                 │                                                          (imperative React API)
                 ▼
          OfficeScene.init() ──> create() ──> update()
```

`createGame()` returns an imperative `OfficeController` handle with 27 methods consumed by React:
- **Camera & View**: `zoomIn()`, `zoomOut()`, `resetView()`, `setViewShift(cssPx)`
- **Remote Roster**: `setPlayers(list)`, `upsertPlayer(p)`, `movePlayer(id, x, y, dir, moving, seated)`, `removePlayer(id)`
- **Avatar Look & State**: `setPlayerCharacter(id, char)`, `setOwnCharacter(char)`, `setPlayerZone(id, zone)`, `setPlayerStatus(id, status)`, `setOwnStatus(status)`, `setVoice(id, inCall, talking)`
- **Office Features**: `setDesks(desks)`, `showChat(userId, text)`, `setTaskCounts(counts)`, `setLockedRooms(ids)`, `setRoomBookings(bookings)`
- **Locomotion & Debug**: `setJoystick(x, y)`, `snapshot()`, `localPosition()`, `teleportTo(x, y)`
- **Lifecycle & Editor**: `setLayout(layout)`, `startEditing(editor, onProblem)`, `setPaused(paused, mode)`, `destroy()`

#### The Step Loop & Background Modes
When modals or drawers cover the canvas, `setPaused(paused, mode)` pauses the display's requestAnimationFrame clock via `game.loop.sleep()` and starts a manual interval timer:
- **`hidden` mode (interval = 100 ms / ~10 Hz)**: Used when full-screen minigames cover the office. Disables scene visibility (`sys.settings.visible = false`) and blocks keyboard input (`setInputBlocked(true)`). Bypasses GPU rendering entirely while keeping remote player lerping, voice proximity sweeps, and timers ticking.
- **`throttled` mode (interval = 66 ms / ~15 Hz)**: Used when the task board drawer slides out. Renders at ~15 FPS to reduce GPU overhead while keeping animations alive behind the glass drawer.
- **Active mode**: Resumes full 60 FPS via `game.loop.wake()`, resets keyboard inputs, and clears joystick vectors so avatars never get stuck walking. (See [performance.md](performance.md) for frame budgets).

### 2. OfficeScene lifecycle & subsystem delegation

`OfficeScene` coordinates eight specialized subsystems, owning only the top-level loop:
- **Depth (`systems/Depth.ts`)**: Calculates numeric depth values based on entity category and Y coordinates. Owns no mutable state.
- **ViewControl (`systems/ViewControl.ts`)**: Owns camera tracking, viewport bounds, user zoom level (`userZoom`), and horizontal drawer offset (`viewShift`).
- **RoomLocks (`systems/RoomLocks.ts`)**: Owns solid physics colliders over booked meeting rooms (`lockedSolids`) and unauthorized occupant detection.
- **Seating (`systems/Seating.ts`)**: Owns candidate seat dwell timing (`dwellMs`), stand hold timing (`standHoldMs`), current seat state (`seat`), and just-left re-sit guards (`justLeft`).
- **NetSync (`systems/NetSync.ts`)**: Owns remote player entity instances (`remotes`), remote zone cache (`remoteZones`), and rate-limited movement broadcasts (`lastSent`).
- **FurnitureSprites (`systems/FurnitureSprites.ts`)**: Owns placed furniture sprite game objects (`sprites`), drop shadows, and wall-mounted fade registrations (`wallMounted`).
- **Interactions (`systems/Interactions.ts`)**: Owns interactive trigger bounding boxes (`targets`), active hover target, and prompt bubble display objects (`hint`).
- **Proximity (`systems/Proximity.ts`)**: Owns peer distance cache (`near`), threshold hysteresis, and proximity event dispatching (`player:near`, `player:distance`, `player:far`).

```
                              ┌────────────────────────┐
                              │      OfficeScene       │
                              └───────────┬────────────┘
         ┌────────────┬─────────────┬─────┴──────┬────────────┬─────────────┐
         ▼            ▼             ▼            ▼            ▼             ▼
   ViewControl    RoomLocks      Seating      NetSync    Furniture   Interactions
   (Camera/Pan)  (Colliders)  (Dwell/State)  (Remotes)    Sprites     & Proximity
                                                 │       (Textures)   (Spatial UI)
                                                 ▼            │
                                            RemotePlayer      ▼
                                            (Avatar lerp)   Avatar (Local)
```

### 3. Rendering pipeline

The rendering pipeline builds the visual world in distinct passes:

```
[1. Layout JSON] ──> [2. Baked Static Scenery] ──> [3. 2.5D Wall Faces] ──> [4. Furniture Sprites] ──> [5. Dynamic Entities]
                     (512px Chunk Textures)        (1-Tile Fading Columns)   (Dynamic Textures)         (Avatars, Badges, Hints)
```

1. **Static Scenery Baking (`render/scenery.ts`, `render/floors.ts`)**: Floors (oak, terrazzo, carpet) and floor labels are drawn into invisible graphics objects, sliced into 512 × 512 px chunks (`CHUNK_PX = 512`), and baked into static Phaser `RenderTexture` instances at `DEPTH.floor`.
2. **2.5D Wall Faces & Wall Fade (`render/walls.ts`, `render/wallFaces.ts`)**: Horizontal solid walls rise 80 px (`WALL.solid.height = 80`) from their base line, rendered with painted drywall (`WALL_PAINT = 0xeee9e2`), bottom skirting (`SKIRTING = 0xd6cec3`), a thin dark cap (`SOLID_CAP_BASE = 0x2d3236`), and a 6 px contact floor shadow (`WALL_SHADOW = 6`). Glass partitions have a 6 px collider thickness and 80 px height rendered with transparent blue tint (`GLASS_TINT = 0xcfe7ef`, alpha 0.3). To prevent tall walls from occluding walking avatars, each solid wall face is pre-sliced into 1-tile wide column images. During `update()`, any column within 58 px of a character's feet fades smoothly to `FADE_ALPHA = 0.35` (or `FURNITURE_ALPHA = 0.5` if concealing furniture). Wall-mounted items (`tv`, `board`, `legoBoard`) continuously track `wallFaces.alphaFor(x, y)` to fade in sync with the wall slice behind them.
3. **Furniture Sprites (`render/sprites.ts`, `render/furniture.ts`)**: Placed furniture is drawn procedurally into dynamic textures and displayed as Phaser Images. Items with variants (`desk`, `plant`, `bookshelf`, `meetingTable`) seed their details using the item's unique ID. Workstation desks reflect their owner's character appearance, aesthetic vibe, and open task count (growing paper stacks up to 9 sheets). Solid furniture renders a soft drop shadow (`DEPTH.shadow`).

### 4. Depth sorting

Entities sort along discrete depth bands defined in `systems/Depth.ts` and `constants.ts`:

```
Depth 900  ──────────────────────────────────────────  DEPTH.hints (Interaction prompt bubbles)
Depth 20   ──────────────────────────────────────────  DEPTH.badges (Meeting room status & occupancy)
Depth 10+Y ──────────────────────────────────────────  DEPTH.sorted (Y-sorted entities)
           ├── Desk Nameplates: DEPTH.sorted + 0.9 (DESK_PLATE_DEPTH_OFFSET)
           ├── Seated Avatars: chairDepth + 0.000001 (1e-6)
           ├── Wall-mounted Art: wallBase / 100,000 + 0.0000001 (1e-7)
           ├── Standing Avatars: feetY / 100,000
           └── Standing Furniture: bottomY / 100,000
Depth 2    ──────────────────────────────────────────  DEPTH.shadow (Drop shadows)
Depth 1    ──────────────────────────────────────────  DEPTH.rug (Floor layer: rugs, carpets)
Depth 0    ──────────────────────────────────────────  DEPTH.floor (Baked static scenery chunks)
```

Exact sorting formulas:
- **Furniture**: Rugs map directly to `DEPTH.rug` (`1`). Standing furniture evaluates its bounding box bottom edge:
  $$\text{depth} = 10 + \frac{(y + h) \times 32}{100\,000}$$
  Wall-mounted items (`tv`, `board`, `legoBoard`) sort against the base line of the wall face they mount upon:
  $$\text{depth} = 10 + \frac{\text{basePx}}{100\,000} + 10^{-7}$$
- **Avatars**: Standing avatars sort by feet Y coordinate:
  $$\text{depth} = 10 + \frac{y_{\text{feet}}}{100\,000}$$
  Seated avatars within `SEATED_DEPTH_RADIUS_PX = 24` bind to their chair's depth to avoid clipping through armrests:
  $$\text{depth} = \text{furnitureDepth}(\text{chair}) + 10^{-6}$$
- **Desk Plates**: Anchor to workstation desks at:
  $$\text{depth} = \text{DEPTH.sorted} + 0.9$$

### 5. Art recipes, DNA & the Pen abstraction

All character and furniture visuals are drawn algorithmically using vector commands:
- **DNA Encoding (`art/recipe.ts`)**: A character `Recipe` specifies 17 discrete attributes: build (`slim`, `regular`, `broad`), height (short, average, tall), skin tone index, hairstyle (12 styles from short to braids), hair color, beard (4 options), glasses (4 options), freckles, top (tee, hoodie, shirt, sweater, blazer), top color, trim color, pattern (plain, stripes, logo), bottom (trousers, shorts, skirt), bottom color, shoes, hat (none, beanie, cap), hat color, and aesthetic vibe (`minimal`, `cozy`, `gamer`, `artist`, `scholar`). Encoded as version `"1"` followed by 17 base-36 digits (e.g. `"1014a020104100000"`), storing complete visual identities in compact database strings interoperable with legacy named presets (`maya`, `sam`, etc.).
- **The Pen Abstraction (`art/pen.ts`)**: Drawing functions take a `Pen` interface (`rect`, `circle`, `ellipse`, `poly`, `pie`, `ring`, `line`, `frame`, `push`, `pop`). Backends include `phaserPen` (game Graphics), `canvasPen` (HTML5 Canvas in Art Lab), and `svgPen` (React UI pickers). Characters and desks draw identically across in-game sprites, React UI modals, and the standalone design tool.
- **Perceptual Color Space (`art/color.ts`)**: Colors are authored in OKLCH (Lightness, Chroma, Hue). Out-of-gamut shades gracefully desaturate chroma while preserving exact perceptual lightness, ensuring generated shirts never flare brighter than intended and maintaining high visual harmony across generated characters.
- **Design Tool**: Standalone design environment documented in [tools/art-lab/README.md](../../tools/art-lab/README.md).

### 6. Input handling

Locomotion and interaction inputs operate strictly through specific input channels:
- **Keyboard Locomotion**: Local avatar movement is driven exclusively by arrow keys or WASD. Arrow/WASD states compute a normalized direction vector scaled by `WALK_SPEED = 170` px/s into Arcade Physics velocity.
- **Touch Joystick**: On touch screens, `Joystick.tsx` renders an overlay thumbstick. Dragging converts thumb offset into normalized `[-1..1]` vectors fed into `controller.setJoystick(x, y)`. An 8 px deadzone prevents drifting.
- **Pointer / Mouse Clicks**: Mouse clicks do **not** provide pathfinding click-to-move for avatar locomotion. Pointer clicks trigger interactive furniture prompts via `interactions.hits(worldX, worldY)`, control camera wheel zooming (`wheel`), or operate drag-and-drop placement in `EditMode`.
- **Typing Guard**: When an HTML `<input>` is focused or `inputBlocked` is active, keyboard input is suppressed.

### 7. Seating, room locks & proximity

- **Seating (`systems/Seating.ts`)**: Supports chairs, armchairs, and stools. Standard seats detect proximity via Euclidean radius (`SEAT_ZONE_TILES = 0.45` tiles / 14.4 px), while armchairs use an expanded bounding box (`ARMCHAIR_MARGIN_PX = 8` px). When an avatar dwells near a free chair for `SIT_DWELL_MS = 500` ms, the avatar snaps to the seat coordinate (`SEAT_Y_OFFSET_PX = 5`), disables physics collision, faces the chair's orientation (or current facing for stools), and enters seated state. Standing up requires pressing and holding a movement key for `STAND_HOLD_MS = 500` ms. The avatar steps off 22 px (`STEP_OFF_DISTANCE_PX = 22`) evaluating directional priority: intentional input direction > chair facing direction > free fallback cardinal directions. A `justLeft` guard prevents accidental immediate re-sitting until the player completely exits the seat trigger area.
- **Room Locks (`systems/RoomLocks.ts`)**: Booked meeting rooms receive dynamic solid colliders. Unauthorized avatars are blocked from entering; if a player is standing inside when a room locks, they are instantly evicted to the building entrance.
- **Spatial Proximity (`systems/Proximity.ts`)**: Evaluates Euclidean distances between avatars in tiles. Emits `player:near` at $< 3.0$ tiles (`NEAR_RADIUS`) and `player:far` at $> 3.5$ tiles (`FAR_RADIUS`), incorporating a 0.5-tile hysteresis buffer to prevent voice oscillation. People in different rooms are strictly partitioned: acoustic boundaries (even transparent glass walls) prevent spatial audio connection. Distance changes are throttled to at most 5 updates per second (`DISTANCE_EVERY_MS = 200` ms) when delta $\ge 0.05$ tiles.

### 8. Layout editor & mirror architecture

The editor decouples engine graphics from React toolbars:
- `LayoutEditor.ts`: Headless state container holding furniture, selections, and undo/redo stacks (`past`, `future`).
- `EditMode.ts`: Phaser interaction layer rendering ghost placement previews, rotation gizmos, and marquee selection boxes.
- `EditorPanel.tsx`: Floating React UI subscribing to `LayoutEditor` changes via `useEditorState` (`useSyncExternalStore`).
- Data contracts and mounting math are mirrored between backend API and web client. See [layout.md](layout.md) for data model contracts and Docker isolation rationale.

---

## Rules & invariants

1. **Strict 32 px Tile Metrics**: World coordinates are defined in tiles where 1 tile = exactly 32 × 32 pixels (`TILE = 32`). Layout definitions specify all furniture and walls in fractional or integer tiles.
2. **Feet-Centric Physics Hull**: The local avatar is anchored at the feet `(x, y)` with an Arcade Physics body measuring 18 px wide and 10 px tall (`PLAYER_BODY_WIDTH_PX = 18`, `PLAYER_BODY_HEIGHT_PX = 10`), offset by $(-9, -10)$ px.
3. **Decoupled Remote Interpolation**: Remote avatars have no physics bodies. Their positions arrive at 20 Hz and are buffered in `RemotePlayer`, rendering smoothly with a 100 ms interpolation lag (`INTERPOLATION_DELAY_MS = 100`).
4. **Server Authority**: The client editor performs quick heuristic checks (`editor/rules.ts`), but the backend validator (`apps/api/src/office/layout/validate.ts`) is authoritative, executing 8 px BFS reachability before persisting changes.
5. **No Static Spritesheets**: All artwork is procedural vector math drawn through dynamic textures. Textures are ref-counted and evicted when released to guarantee zero memory leakage.
6. **Acoustic Room Isolation**: Avatars separated by room boundaries cannot establish spatial audio, even across glass partitions.

---

## Why it's built this way

1. **Phaser embedded inside Next.js**: Provides canvas rendering, WebGL batching, camera tweens, and Arcade Physics while allowing Next.js to manage authentication, navigation, and WebSocket connections.
2. **Procedural vector art instead of pixel spritesheets**: Eliminates megabytes of static image downloads. Enables infinite procedural character combinations (height, skin, hair, clothing, color tints), live desk customization, and dynamic paper stacks indicating task counts.
3. **Chunked scenery baking**: Baking static floors and room labels into 512 px textures collapses thousands of per-tile draw calls down to a handful of textured quads per frame.
4. **1-tile wall slicing for alpha fading**: Solves the 2.5D occlusion challenge where tall horizontal walls obscure avatars. Slicing faces into 1-tile columns allows smooth localized transparency without per-frame canvas re-rendering.
5. **Three-tier background step loop**: Suspending the 60 FPS requestAnimationFrame loop when full-screen games (`hidden`) or side drawers (`throttled`) are open drastically cuts CPU/GPU usage on laptops while maintaining WebSockets and voice proximity.

---

## How to change it safely

### Step-by-step walkthrough: Add a new furniture kind (e.g. `'cooler'`)

To add a new piece of furniture, modify the codebase in the following verified order:

1. **API Data Contracts**: In `apps/api/src/office/layout/types.ts`, add `'cooler'` to the `FURNITURE_KINDS` array.
2. **API Solid Geometry**: In `apps/api/src/office/layout/geometry.ts`, add `cooler: true` (or `false` if walkable) to `SOLID: Record<FurnitureKind, boolean>`.
3. **API Wall Mounting & Door Protection** (if applicable):
   - If wall-mounted, add `'cooler'` to `WALL_MOUNTED` in `apps/api/src/office/layout/mount.ts`.
   - If protected from doorway demolition, add `'cooler'` to `PROTECTED_KINDS` in `apps/api/src/office/layout/wings.door.ts`.
4. **Web Layout Types Mirror**: In `apps/web/game/layout/types.ts`, add `'cooler'` to the `FurnitureKind` union type.
5. **Web Mounting Mirror** (if wall-mounted): In `apps/web/game/layout/mount.ts`, update `WALL_MOUNTED` to keep it byte-identical to the API.
6. **Web Procedural Draw Recipe**: In `apps/web/game/render/furniture.ts`, implement `cooler: DrawFn` and register it in `FURNITURE: Record<FurnitureKind, FurnitureSpec>` with `{ solid: true, draw: cooler }`.
7. **Web Dynamic Texture Cache**: In `apps/web/game/render/sprites.ts`, add `'cooler'` to `VARIES` if it features randomized visual details; if wall-mounted, add sizing cases in `wallArtSize()`.
8. **Web Editor Catalog**: In `apps/web/game/editor/catalog.ts`, append a `CatalogItem` entry to `CATALOG` specifying `{ kind: 'cooler', label: 'Water cooler', w: 1, h: 1, group: 'Kitchen' }`.
9. **Web Editor UI Icon**: In `apps/web/features/office/EditorPanel.tsx`, map `cooler` to an icon in `ICON: Record<FurnitureKind, LucideIcon>` (e.g. `Droplet` or `Refrigerator`).
10. **Web Architectural Minimap**: In `apps/web/features/workspace/LayoutPreview.tsx`, add a preview color mapping in `FURNITURE_COLOR` (and add to `round` check if circular).
11. **Golden Snapshots & Verification**: Run backend snapshot tests:
    ```bash
    npx vitest run apps/api/src/office/layout/layout.snapshot.spec.ts
    ```
    If new furniture is placed into default templates, update golden snapshots intentionally via `-u`.

---

## Tests

The office engine, layout integrity, and real-time interaction systems are verified by the following test suites:

- **Layout Snapshots**: `apps/api/src/office/layout/layout.snapshot.spec.ts` executes golden snapshot comparisons against `__snapshots__/layout.snapshot.spec.ts.snap` across all built-in templates and wing chains.
- **Template Conformance**: `apps/api/src/office/templates/templates.spec.ts` verifies valid furniture bounds, desk counts, and room accessibility.
- **Physical Validation**: `apps/api/src/office/layout/validate.spec.ts` tests bounds, overlap detection, wall collisions, and 8 px walkability BFS reachability.
- **End-to-End Office Suites**: `e2e/tests/office.spec.ts` and `e2e/tests/office-live.spec.ts` run multi-browser Playwright tests verifying avatar arrival, movement, desk claiming, chat, room bookings, and layout editing.
- **Pathfinding Navigation**: `e2e/tests/support/walker.ts` drives A* avatar navigation using the office layout walkability grid with minimap position feedback.
- **Spatial Minigame Integration**: `e2e/tests/foosball.spec.ts`, `e2e/tests/uno.spec.ts`, `e2e/tests/lego.spec.ts`, and `e2e/tests/chill.spec.ts` test furniture proximity triggers and modal handoffs.

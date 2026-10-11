# Office Layout Architecture

## 1. Purpose

An office layout in DevPulse defines the complete architectural and physical configuration of a virtual office workspace. It is represented as a single JSON document stored directly in the `layout` column on the `Workspace` database row.

All spatial dimensions, positions, and coordinates in layout definitions are expressed in grid tiles. Each grid tile measures exactly 32 × 32 pixels (`TILE = 32`).

A layout specifies:
- **Dimensions**: overall building width and height in tiles (`width`, `height`).
- **Rooms**: designated zones (open work spaces, meeting rooms, lounges, and chill rooms) with floor materials and optional tints.
- **Walls**: structural line segments (`solid` or `glass`) that delimit room boundaries and the building exterior. Gaps between wall segments form doorways.
- **Furniture**: placed items (desks, chairs, dividers, tables, appliances, couches, plants, whiteboards) with tile coordinates, dimensions, orientations, and colors.
- **Spawn**: the coordinate `spawn: { x, y }` where avatars arrive when entering the office, typically located inside the south entrance door.
- **Generated Metadata**: an optional `generated?: { teamSize: number; seed: string }` record indicating procedural parameters if the layout was generated algorithmically, enabling the layout to be rebuilt or reset.

---

## 2. Where it lives

The office layout system spans the backend API (`apps/api`) and the frontend web client (`apps/web`).

| Subsystem | File Path | One-line Job |
| --- | --- | --- |
| **API Layout** | `apps/api/src/office/layout/types.ts` | Data contracts, furniture kind catalog, room kinds, and layout JSON interfaces. |
| **API Layout** | `apps/api/src/office/layout/geometry.ts` | Tile constants, solid furniture definitions, bounding boxes, wall colliders, desk seat math, and desk ordering. |
| **API Layout** | `apps/api/src/office/layout/mount.ts` | Wall-mounting rules, base line detection, and snapping items flush against south-facing wall faces. |
| **API Layout** | `apps/api/src/office/layout/migrate.ts` | Legacy layout migration snapping unaligned wall-mounted items or dropping unmountable items. |
| **API Layout** | `apps/api/src/office/layout/validate.ts` | Server-authoritative layout validator checking bounds, wall clearance, overlaps, and avatar reachability BFS. |
| **API Layout** | `apps/api/src/office/layout/random.ts` | Deterministic seeded pseudo-random number generator (FNV-1a + Mulberry32) and array shuffle/pick utilities. |
| **API Layout** | `apps/api/src/office/layout/wings.types.ts` | Domain types, options, error classes (`WingError`), and span structures for wing extensions. |
| **API Layout** | `apps/api/src/office/layout/wings.plan.ts` | Room, wall, and furniture generators for side wings, bottom wings, and dedicated chill wings. |
| **API Layout** | `apps/api/src/office/layout/wings.door.ts` | Door candidate scanning along shared walls, protected furniture collision, and collinear wall splitting. |
| **API Layout** | `apps/api/src/office/layout/wings.ts` | Six-stage procedural wing expansion pipeline (frame, shift, plan, prepare shared wall, cut door, validate). |
| **API Templates** | `apps/api/src/office/templates/builder.ts` | Fluent `LayoutBuilder` helper constructing desk clusters, meeting rooms, lounges, kitchens, and game rooms. |
| **API Templates** | `apps/api/src/office/templates/palette.ts` | Shared hex color palettes for carpet and sofa variations across templates and wings. |
| **API Templates** | `apps/api/src/office/templates/generated.ts` | 3-step procedural office generator creating layouts sized to team capacity from a seed string. |
| **API Templates** | `apps/api/src/office/templates/loft.ts` | Static template for small teams (1–8 people): 1 meeting room, kitchen, chill room, and 8 desks. |
| **API Templates** | `apps/api/src/office/templates/studio.ts` | Static template for medium teams (6–24 people): 2 meeting rooms, kitchen/lounge, and 24 desks. |
| **API Templates** | `apps/api/src/office/templates/campus.ts` | Static template for large teams (20–48 people): 3 meeting rooms, expansive lounge, and 48 desks. |
| **API Templates** | `apps/api/src/office/templates/hq.ts` | Static template for enterprise teams (40–100 people): 4 meeting rooms, dual chill corners, and 100 desks. |
| **API Templates** | `apps/api/src/office/templates/index.ts` | Template registry exposing `TEMPLATES` metadata, default team size (`DEFAULT_TEAM = 12`), and lookup helpers. |
| **API Workspace** | `apps/api/src/workspace/workspace.service.ts` | Workspace lifecycle service handling creation, template switching, layout updates, wing additions, and optimistic locking. |
| **API Workspace** | `apps/api/src/workspace/desks.service.ts` | Desk allocations, member claiming/moves, conflict prevention, and automatic desk synchronization across layout changes. |
| **API Workspace** | `apps/api/src/workspace/layout-migration.service.ts` | NestJS `OnModuleInit` service running on startup to migrate legacy wall-mounted items across all workspace layouts. |
| **API Workspace** | `apps/api/src/workspace/workspace.controller.ts` | REST endpoints for layout updates (`PUT /workspace/layout`), wing expansion (`POST /workspace/wings`), and desks. |
| **API Workspace** | `apps/api/src/workspace/workspace.dto.ts` | Class-validator schemas for layout modification (`UpdateLayoutDto`), wing generation (`WingDto`), and desk allocation. |
| **API Workspace** | `apps/api/src/workspace/workspace-events.ts` | Internal RxJS event bus distributing `layout`, `desks`, and member change events across services and gateways. |
| **Web Layout** | `apps/web/game/layout/types.ts` | Frontend layout types mirrored from API, plus client-specific `Zone` and `ZoneType` definitions. |
| **Web Layout** | `apps/web/game/layout/geometry.ts` | Client mirror of geometric bounds, desk seat coordinates, rectangle intersection, and desk ordering. |
| **Web Layout** | `apps/web/game/layout/mount.ts` | Byte-for-byte mirror of API mounting math determining wall face attachment and slack. |
| **Web Layout** | `apps/web/game/layout/derive.ts` | Pure layout derivations computing active zones (desks, meetings, lounges) and floor labels from layout state. |
| **Web Editor** | `apps/web/game/editor/LayoutEditor.ts` | Headless editor state machine tracking furniture mutations, selections, undo/redo history stacks, and API payloads. |
| **Web Editor** | `apps/web/game/editor/EditMode.ts` | Phaser interactive input controller handling drag-and-drop, ghost previews, selection bounding boxes, and shortcut keys. |
| **Web Editor** | `apps/web/game/editor/catalog.ts` | Palette catalog defining placeable furniture kinds, standard dimensions, grouping categories, and default colors. |
| **Web Editor** | `apps/web/game/editor/rules.ts` | Fast client-side placement validator checking bounds, wall collision, mounting, and overlap during drag gestures. |

---

## 3. The data model

All data models are defined in `apps/api/src/office/layout/types.ts` (mirrored in `apps/web/game/layout/types.ts`).

### Data structures

```typescript
export interface OfficeLayout {
  width: number;             // Building width, in tiles (32 px each)
  height: number;            // Building height, in tiles (32 px each)
  rooms: Room[];             // Defined functional zones
  walls: Wall[];             // Physical barrier segments
  furniture: Furniture[];     // Placed equipment and decor items
  spawn: { x: number; y: number }; // Avatar entry position, in tiles
  generated?: {              // Present if built by procedural algorithm
    teamSize: number;
    seed: string;
  };
}
```

#### `Room`
- `id: string`: Unique room identifier (e.g. `'atlas'`, `'lounge'`, `'chill'`, `'open'`).
- `name: string`: Human-readable display label (e.g. `'Atlas'`, `'Kitchen'`, `'Chill room'`).
- `kind: RoomKind`: One of `'open'` | `'meeting'` | `'lounge'` | `'chill'`. In the game, rooms of kind `'meeting'`, `'lounge'`, and `'chill'` automatically become interactive audio/activity zones.
- `x: number`, `y: number`: Top-left corner coordinates, in tiles.
- `w: number`, `h: number`: Width and height dimensions, in tiles.
- `floor: FloorKind`: Flooring texture style (`'oak'` | `'carpet'` | `'terrazzo'`).
- `color?: number`: Optional integer hex color tint applied to carpet floors (e.g. `0x7d8796`).

#### `Wall`
- `x1: number`, `y1: number`: Start coordinate, in tiles.
- `x2: number`, `y2: number`: End coordinate, in tiles.
- `kind: 'solid' | 'glass'`: Material type. Solid walls represent opaque drywall/masonry; glass walls represent transparent interior partitions.
- `face?: boolean`: When omitted or `true`, horizontal walls render a tall south-facing wall face in 3/4 perspective. Set to `false` for south exterior walls so the building interior remains visible.

#### `Furniture`
- `id: string`: Unique identifier within the layout (e.g. `'desk-1'`, `'w1-sofa-4'`).
- `kind: FurnitureKind`: Item kind from the catalog.
- `x: number`, `y: number`: Geometric center of the item, in tiles.
- `w: number`, `h: number`: Unrotated bounding width and height, in tiles.
- `rotation?: 0 | 90 | 180 | 270`: Orientation in degrees clockwise. Rotation `0` means an avatar using the item faces north (upwards).
- `color?: number`: Optional integer hex tint for upholstery and textiles.

### Furniture kinds

The catalog in `FURNITURE_KINDS` defines 21 supported kinds:
- Work: `'desk'`, `'chair'`, `'divider'`, `'bookshelf'`, `'board'`
- Meetings: `'meetingTable'`, `'tv'`
- Lounge: `'sofa'`, `'armchair'`, `'coffeeTable'`, `'rug'`, `'floorLamp'`, `'beanbag'`
- Kitchen: `'counter'`, `'fridge'`, `'barTable'`, `'stool'`
- Plants: `'plant'`
- Games: `'foosball'`, `'cardTable'`, `'legoBoard'`

### Wall kinds and faces

Walls are axis-aligned segments:
- **Solid walls**: Rendered with a physical collision thickness of 10 px (`SOLID_THICKNESS = 10`). Horizontal solid walls render a tall front face downward unless `face: false`.
- **Glass walls**: Rendered with a physical collision thickness of 6 px (`WALL.glass.thickness = 6`). They provide sightlines into meeting rooms while blocking avatar movement.
- **Doorways**: Door openings are not separate entity types; they are physical gaps between collinear wall segments.

### Wall-mounted items and mounting logic (`mount.ts`)

Certain furniture kinds hang on walls rather than sitting on the floor:
- Defined in `WALL_MOUNTED`: `'tv'`, `'board'`, `'legoBoard'`.
- Helper predicate: `isWallMounted(kind: FurnitureKind): boolean`.

How `mount.ts` determines if an item hangs on a wall:
1. **Rotation check**: Wall-mounted items cannot be rotated (`if (item.rotation) return null`).
2. **Face base detection**: `faceBase(wall)` inspects candidate walls. A wall provides a mountable face if and only if:
   - It is horizontal (`wall.y1 === wall.y2`),
   - It is solid (`wall.kind === 'solid'`), and
   - It shows a face (`wall.face !== false`).
   The face base line sits at `wall.y1 + SOLID_THICKNESS / 2 / TILE` (i.e. `wall.y1 + 5/32` tiles).
3. **Horizontal bounds**: The item's horizontal span `[item.x - w/2, item.x + w/2]` must remain within the wall's horizontal span `[min(x1, x2), max(x1, x2)]` with an edge tolerance of `EDGE = 0.05` tiles.
4. **Vertical clearance**: The top edge of the item `top = item.y - item.h / 2` must align with the wall's base line within slack boundaries:
   `top >= base - EDGE && top <= base + MOUNT_SLACK` (`MOUNT_SLACK = 0.5` tiles).

`snapToWall<T>(item, walls, maxDistance = 4)` scans all qualifying wall faces within `maxDistance` tiles, clamps the x position so the item stays within the wall ends, aligns `y = base + item.h / 2`, sets `rotation: 0`, and returns the snapped coordinate.

---

## 4. Templates

Layouts are authored programmatically using `LayoutBuilder` helpers in `apps/api/src/office/templates/builder.ts`.

### LayoutBuilder helpers
- `deskCluster(ox, oy)`: Adds a 4-desk collaborative cluster (6 × 5 tiles). Two desks face south (`rotation: 180`) with chairs, two face north (`rotation: 0`) with chairs, a divider divides them horizontally, and a plant is placed at `ox + 6.65, oy + 2.5`.
- `meetingRoom(x, w, tableW, oy = 0)`: Mounts a wall screen (`tv`), places a central `meetingTable`, surrounds it with chairs north and south (spaced 2 tiles apart) plus side chairs if clearance allows, and adds a potted plant.
- `kitchen(x, counterW, oy = 0)`: Places a kitchen `counter` and `fridge` along the north wall.
- `barTable(cx, cy)`: Adds a high bar table with 6 stools (3 north, 3 south).
- `chillCorner(cx, sofaColor, oy = 0)`: Centers a decorative rug (9.5 × 6.4 tiles) with a sofa facing south, a coffee table, two armchairs (facing east/west), and two beanbags.
- `waitingArea(cx, wallY)`: Positions a sofa, coffee table, armchairs, and rug adjacent to the south wall entrance.
- `doormat(cx, wallY)`: Places a thin entrance rug inside the doorway.
- `cardTableWithSeats(cx, cy)`: Places a 2.2 × 2.2 card table with 6 chairs (2 north, 2 south, 1 west, 1 east).
- `chillRoom(rx, ry, rw = 11, rh = 12)`: Assembles a dedicated recreation space with 1 foosball table, 1 card table with 6 chairs, 1 wall-mounted `legoBoard`, a rug, and a plant. Adapts dynamically for tall wings, wide wings, or compact rooms.

### The generated office algorithm (`generated.ts`)

Procedural generation creates an office customized to any team size (1 to 100) via `generatedOffice(teamSize, seed)`. The algorithm proceeds in three steps:

```
+------------------------------------------------------------------------+
| STEP 1: NORTH BAND (depth = 12 tiles)                                  |
| [Meeting Room 1] [Meeting Room 2] ... [Kitchen & Lounge] [Chill Corner]|
+------------------------------------------------------------------------+
| STEP 2: OPEN SPACE GRID                                                |
|   [Cluster 1]       [Cluster 2]       [Cluster 3]      (Bookshelf)     |
|   [Cluster 4]       [Cluster 5]       [Cluster 6]                      |
+------------------------------------------------------------------------+
| STEP 3: ENTRANCE & SOUTH BOUNDARY                                      |
|   [Waiting Area]               [DOORWAY / SPAWN]        [Waiting Area] |
+------------------------------------------------------------------------+
```

1. **Step 1: North band (depth = 12 tiles)**
   - Computes required meeting rooms: `meetingRoomsFor(team) = min(4, max(1, ceil(team / 10)))`.
   - The first room is large (`w: 13, table: 7`) or medium (`w: 11, table: 5`), subsequent rooms are small (`w: 9, table: 4.2`).
   - Generates glass dividing walls with door openings offset near the east wall.
   - The remainder of the band becomes the lounge (`floor: 'terrazzo'`), populated with a kitchen counter sized to team tier (`counterW` = 6, 8, or 9 tiles), a high bar table, a chill corner, and a second chill corner if lounge width ≥ 34 tiles.
2. **Step 2: Central open space grid**
   - Calculates desk capacity with ~25% headroom: `desksFor(team) = max(4, ceil(team * 1.25))`.
   - Derives cluster count: `clusters = ceil(desks / 4)`.
   - Determines grid columns (`cols = min(6, ceil(sqrt(clusters)))`) and rows (`rows = ceil(clusters / cols)`).
   - Centers the desk clusters across the width, randomly placing decorative plants between clusters (70% probability). Mounts a Kanban board on the lounge south wall and adds bookshelves along the outer wall.
3. **Step 3: Southern entrance**
   - Centers a 4-tile door opening on the south wall at `door = Math.round(width / 2)`.
   - Sets avatar spawn at `spawn: { x: door, y: height - 2.5 }`.
   - Places an entrance doormat, a waiting area at `x = 6`, and an optional second waiting area at `x = width - 7` if width ≥ 50 tiles.

**How the seed works**:
The seed string only changes visual aesthetics, not structural capacity. The team size strictly dictates the number of clusters, room dimensions, and grid dimensions. The seed controls:
- Carpet and sofa palette selection from `CARPETS` and `SOFAS`.
- Shuffling of meeting room names from `ROOM_NAMES`.
- Meeting room size ordering.
- Horizontal layout flipping (`flip = rand() < 0.5`), mirroring rooms east-to-west.
- Plants between clusters and bookshelf placement.

### Built-in templates list (`TEMPLATES`)

Registered in `apps/api/src/office/templates/index.ts`:

| ID | Name | Team Range | Description |
| --- | --- | --- | --- |
| `generated` | Made for your team | 1 – 100 | Procedural layout sized to team capacity; default team size is 12 (`DEFAULT_TEAM`). |
| `loft` | Loft | 1 – 8 | Compact office with 1 meeting room (Focus), kitchen lounge, chill game room, and 8 desks. Supports wing expansions. |
| `studio` | Studio | 6 – 24 | Medium office with 2 glass meeting rooms (Atlas, Nova), kitchen lounge, and 24 desks. |
| `campus` | Campus | 20 – 48 | Large office with 3 meeting rooms (Atlas, Nova, Orion), large lounge, and 48 desks. |
| `hq` | Headquarters | 40 – 100 | Full-floor office with 4 meeting rooms (Atlas, Nova, Orion, Vega), dual chill corners, and 100 desks. |

---

## 5. Wings algorithm

The procedural wing engine allows workspaces to expand on demand by appending wings to the `LEFT`, `RIGHT`, or `BOTTOM` of the building.

### Building layout with wings (ASCII diagram)

```
                       NORTH (Solid Outer Wall)
       +--------------------+---------------------+--------------------+
       |                    |                     |                    |
       |     LEFT WING      |   ORIGINAL OFFICE   |     RIGHT WING     |
       |                    |                     |                    |
       |  +--------------+  |  +---------------+  |  +--------------+  |
       |  | Extra Room   |  |  | North Band    |  |  | Extra Room   |  |
       |  +--------------+  |  +---------------+  |  +--------------+  |
       |  | Door (4 tiles)| = | Door (4 tiles) |  |  | Door (4 tiles)|  |
       |  +--------------+  |  +---------------+  |  +--------------+  |
       |  | Desks / Chill|  |  | Open Space    |  |  | Desks / Chill|  |
       |  +--------------+  |  +---------------+  |  +--------------+  |
       +--------------------+---------------------+--------------------+
                            |                     |
                            |     BOTTOM WING     |
                            |                     |
                            |  +---------------+  |
                            |  | Shared Door   |  |
                            |  +---------------+  |
                            |  | Extra / Desks |  |
                            |  +---------------+  |
                            |  | South Entrance|  |
                            +---------------------+
```

### The 6-step expansion pipeline

Implemented in `apps/api/src/office/layout/wings.ts` via `addWing(layout, side, seed, index, options)`:

1. **Frame (`computeWingFrame`)**:
   - Calculates wing dimensions based on side: `SIDE_WING_DEPTH = 13` for `LEFT`/`RIGHT`, `BOTTOM_WING_DEPTH = 17` for `BOTTOM`.
   - Calculates expansion shift offset. Because coordinate origin `(0, 0)` is top-left, expanding on `LEFT` shifts all existing coordinates east by `depth` (`shift = { x: depth, y: 0 }`). `RIGHT` and `BOTTOM` do not shift existing coordinates (`shift = { x: 0, y: 0 }`).
   - Identifies `sharedCoord`: coordinate of the shared boundary wall.
2. **Shift existing (`shiftExisting`)**:
   - Translates all existing rooms, walls, and furniture by `shift.x`.
3. **Plan wing (`planWing`)**:
   - Randomizes visual theme using `pickWingLook(rand)`.
   - Calls `planChillWing`, `planSideWing`, or `planBottomWing`.
   - Prefixes all new furniture IDs with `w<index>-` (e.g. `w1-desk-1`, `w2-chair-3`) to guarantee globally unique IDs across successive wing expansions.
4. **Prepare shared wall (`prepareSharedWall`)**:
   - For `BOTTOM` wings, removes `face: false` from the previous south exterior wall so it becomes an interior wall.
   - Identifies any pre-existing gaps along the shared wall adjoining the wing's extra room and seals them with solid wall segments to preserve private acoustic boundaries.
5. **Choose and cut door (`cutSharedDoor` & `chooseDoor`)**:
   - Scans candidate doorway positions of width `DOOR_WIDTH_TILES = 4` along the shared wall connecting into an adjacent open room.
   - Evaluates a 3-tile deep search strip (`doorCandidateStrip`) across each candidate coordinate.
   - Rejects candidates if protected furniture (`PROTECTED_KINDS`) is touched.
   - Selects the optimal door position by sorting candidates:
     1. Fewest solid furniture removals (`a.removals - b.removals`).
     2. Closest to the corridor midpoint (`a.distToMid - b.distToMid`).
     3. Seeded tie-break (`rand() - 0.5`).
   - Removes any displaced non-protected furniture (e.g. decorative plants, small tables).
   - Splits collinear shared wall segments around the door interval `[t, t + 4]` using `splitWallsForDoor`.
6. **Assemble and validate (`assembleAndValidate`)**:
   - Merges shifted existing assets with new wing rooms, walls, and furniture.
   - Adjusts avatar spawn (for `BOTTOM` wings, spawn moves to the new southern entrance).
   - Runs full server validation via `validateLayout(resultLayout)`.
   - If validation fails, throws `new WingError('WING_INVALID', problem.message)`.

### Determinism and seed composition

Procedural generation is strictly deterministic. The PRNG seed is formulated as:
`seededRandom(`${seed}:${side}:${index}`)`
Given the workspace seed, attachment side, and sequence index, the generated wing rooms, colors, furniture placement, and door selection are 100% reproducible.

### Error codes

- `NO_DOOR`: Thrown when no viable candidate position exists along the shared wall (e.g. the entire shared wall is blocked by protected furniture or lacks adjacent open space). Message directs the user to move furniture away from that wall.
- `WING_INVALID`: Thrown when the combined layout fails structural or walkability validation.

### Key dimension constants

Defined in `apps/api/src/office/layout/wings.plan.ts` and `apps/api/src/office/layout/wings.door.ts`:
- `SIDE_WING_DEPTH = 13`: Depth of left/right wings, in tiles.
- `BOTTOM_WING_DEPTH = 17`: Depth of bottom wings, in tiles.
- `DESKS_PER_WING = 8`: Number of workstations added by a standard working wing.
- `BOTTOM_EXTRA_ROOM_W = 14`: Width of extra room in a bottom wing.
- `SIDE_EXTRA_ROOM_MIN_H = 12`, `SIDE_EXTRA_ROOM_MAX_H = 16`: Height bounds for extra room in side wings.
- `SIDE_EXTRA_ROOM_CLEARANCE = 14`: Clearance from south wall in side wings.
- `CLUSTER_MARGIN_LEFT = 3.05`, `CLUSTER_MARGIN_RIGHT = 2.85`: Offset of desk clusters from wing outer wall to preserve aisle passage.
- `CLUSTER_W = 7.1`: Standard desk cluster width.
- `DOOR_WIDTH_TILES = 4`: Doorway width cut into shared walls.
- `DOOR_STRIP_DEPTH_TILES = 3`: Depth of doorway clearance search box.
- `DOOR_STRIP_WIDTH_TILES = 5.5`: Width of doorway clearance search box.
- `DOOR_STRIP_PAD_TILES = 0.75`: Margin padding along door opening.
- `DOOR_STEP_TILES = 0.5`: Sliding increment when evaluating door candidates.
- `DOOR_AISLE_MARGIN_TILES = 1`: Required clearance from aisle boundaries.
- `PROTECTED_KINDS`: Set of furniture kinds that cannot be demolished to cut a door (`'desk'`, `'chair'`, `'meetingTable'`, `'board'`, `'foosball'`, `'cardTable'`, `'legoBoard'`).

### Golden snapshots

The test suite in `apps/api/src/office/layout/layout.snapshot.spec.ts` executes golden snapshots against `__snapshots__/layout.snapshot.spec.ts.snap`. These tests freeze the exact JSON structure of all built-in templates, procedural generated offices across team sizes (1, 5, 12, 40, 100) and seeds, and multi-step wing chains (`[LEFT, LEFT, BOTTOM]`, `[RIGHT, BOTTOM, LEFT, RIGHT]`, `[BOTTOM, BOTTOM, RIGHT]`, and chill wings). Any accidental regression in template helpers or wing math immediately breaks snapshot tests.

---

## 6. Validation

Layout integrity is enforced by `apps/api/src/office/layout/validate.ts`.

### Problem codes

`LayoutProblem` reports seven problem codes:

| Problem Code | User Message | Cause |
| --- | --- | --- |
| `OUTSIDE` | "Furniture must be inside the building." | An item's bounding box extends beyond the building outer boundary (`EDGE_MARGIN_TILES = 0.1`). |
| `ON_WALL` | "Furniture can’t stand on a wall or a door." | A solid standing item collides with a wall segment collider box. |
| `NOT_ON_WALL` | "Boards, screens and the Lego wall must hang flush on a tall wall." | A wall-mounted item (`tv`, `board`, `legoBoard`) is not flush against a valid horizontal solid wall face. |
| `OVERLAP` | "Two pieces of furniture overlap." | Two solid items (or two wall-mounted items) intersect by more than `OVERLAP_TOLERANCE = 0.1` tiles. |
| `SPAWN_BLOCKED` | "The entrance is blocked." | The entrance spawn coordinate falls inside an obstacle or wall footprint on the walkability grid. |
| `DESK_UNREACHABLE` | "Nobody can walk to Desk X." | BFS navigation cannot find a path from spawn to the desk's seating interaction circle. |
| `ROOM_UNREACHABLE` | "Nobody can walk into Room." | BFS navigation cannot reach any walkable cell inside the designated room rectangle. |

### The feet-position walkability grid & reachability BFS

Avatar navigation uses a fine-grained collision grid:
- **Resolution**: Grid cells are 8 × 8 pixels (`CELL = 8`).
- **Avatar Footprint**: The avatar body is modeled as 18 px wide and 10 px tall above the feet (`BODY_HALF_W = 9`, `BODY_H = 10`).
- **Marking Blocked Cells (`markBlocked`)**: A cell centered at `(x, y)` is blocked if placing the avatar's feet at `(x, y)` causes the avatar's 18 × 10 body bounding box to touch:
  - Building boundary margins, or
  - Any obstacle rectangle (walls expanded to pixel boxes, and solid furniture shrunk by `OBSTACLE_INSET_PX = 2` px to avoid spurious wall-touching edge cases).
- **Reachability BFS (`reachableFrom`)**:
  - Starts at the avatar entrance spawn cell `cellAt(spawn.x * TILE, spawn.y * TILE)`.
  - Performs 4-directional breadth-first search across walkable cells, producing a `Uint8Array` bitmap of all reachable cells.
- **Verification**:
  - **Desks**: For every numbered desk, computes the seat position in tiles `seatPoint(desk)`. Tests if any cell within `SEAT_REACH_RADIUS_PX = TILE * 0.6` (19.2 px) is marked reachable. If not, reports `DESK_UNREACHABLE`.
  - **Rooms**: Tests all grid cells inside each room rectangle (`cellsIn(toPixels(room))`). If zero interior cells were reached, reports `ROOM_UNREACHABLE`.

### Web editor live checks vs. API authority

To maintain fluid 60 FPS interactions during dragging, the frontend (`apps/web/game/editor/rules.ts`) executes local heuristic checks:
- Live client checks: `outside`, `wall`, `overlap`, and `notOnWall`.
- These provide instantaneous visual feedback (red highlight and explanatory tooltip) while dragging items in Phaser.
- **Server authority**: The web editor does **not** run the full 8 px walkability grid BFS while dragging. The API runs the complete `validateLayout` (including reachability BFS) upon `PUT /workspace/layout`. If the server rejects a layout (e.g. a desk is unreachable), it returns `400 Bad Request` with `LAYOUT_INVALID` and the array of `problems`. The editor catches this response and flags the offending item IDs via `LayoutEditor.flag(itemIds)`.

---

## 7. Saving & growing

### Layout updates (`updateLayout`)

Organizers modify the layout in the web editor and save changes via `PUT /workspace/layout`.
- **Payload (`UpdateLayoutDto`)**: Submits `{ version, furniture, rooms }`.
- **What the editor can change**: Organizers can add, move, rotate, recolor, or delete furniture items, and rename rooms. The editor **cannot** alter building dimensions (`width`, `height`), wall segments, room bounding boxes, or spawn coordinates.
- **Optimistic Concurrency**:
  - The request includes the `version` the client started editing from.
  - In `WorkspaceService.updateLayout`, the database update executes:
    `prisma.workspace.updateMany({ where: { id, layoutVersion: dto.version }, data: { layout, layoutVersion: { increment: 1 } } })`
  - If `count !== 1`, another user saved changes in the interim. The server rejects the save with `FormError('LAYOUT_CHANGED')`.
  - On success, the server emits a `layout` workspace event and triggers `desks.sync(workspaceId)`.

### Adding wings (`addWing` / `addChillWing`)

Organizers expand the building via `POST /workspace/wings` or `POST /workspace/wings/chill`.
- **Preconditions**:
  - Standard wings: Allowed only if `workspace.templateId === 'loft'` (otherwise throws `WINGS_UNSUPPORTED`).
  - Chill wings: Allowed for any template, but only once per office; rejected if `currentLayout.rooms` already contains a room of kind `'chill'` (`CHILL_EXISTS`).
  - User role must be `OWNER` or `ADMIN` (`CAN_MANAGE`).
  - Optimistic locking: `dto.version` must match `workspace.layoutVersion`.
- **Database transaction**:
  1. Updates `Workspace` with the new layout and increments `layoutVersion`.
  2. If the wing is on the `LEFT`, coordinates shift east (`shift.x > 0`). The transaction shifts all pre-existing `OfficeWing` records in the database:
     `tx.officeWing.updateMany({ where: { workspaceId }, data: { x: { increment: shift.x }, y: { increment: shift.y } } })`.
  3. Records a new `OfficeWing` row storing `side`, `seed`, `x`, `y`, `w`, `h`, and `deskCount`.
- **Post-transaction events**:
  - Emits `WorkspaceEvent` of type `'layout'`.
  - Executes `desks.sync(workspaceId)`.

### Workspace events and desk synchronization

- **`layout` event**: Broadcasts `{ type: 'layout', workspaceId, layout, version, by }` over the internal bus, prompting `OfficeGateway` to emit WebSocket event `office:layout` to all connected clients.
- **`desks.sync(workspaceId)`**:
  - Inspects all desks in reading order via `numberedDesks(layout)`.
  - Discovers members whose previously assigned desk was deleted or members who have no desk ("homeless").
  - Assigns free desks to homeless members in order of join date.
  - Updates member records within a transaction and emits a `'desks'` event (`office:desks` WebSocket broadcast) so desk name plates update in real time.

### Migrations (`migrate.ts` & `layout-migration.service.ts`)

- **When they run**: `LayoutMigrationService` implements NestJS `OnModuleInit` and runs once during API server boot.
- **Behavior**: Scans all workspaces in the database. For each layout, it executes `migrateWallMounted(layout)`. If any wall-mounted item was unaligned, it snaps it flush to the nearest valid wall face within 8 tiles or drops it if no wall face exists.
- **Idempotence**: If no furniture positions changed, `migrateWallMounted` returns `changed: false`. The database is not updated and `layoutVersion` is not incremented.

---

## 8. Mirrors table

Code is mirrored between the backend API and frontend web application:

| API Path & Symbols | Web Path & Symbols | Identical? | Notes & Divergence |
| --- | --- | --- | --- |
| `apps/api/src/office/layout/mount.ts`<br>`WALL_MOUNTED`, `isWallMounted`, `faceBase`, `mountWall`, `snapToWall` | `apps/web/game/layout/mount.ts`<br>`WALL_MOUNTED`, `isWallMounted`, `faceBase`, `mountWall`, `snapToWall` | **Yes** | Byte-identical except line 1 comment. Shared mounting logic. |
| `apps/api/src/office/layout/geometry.ts`<br>`Rect`, `itemBounds`, `seatPoint`, `overlaps`, `numberedDesks`, `TILE`, `SOLID`, `wallRect`, `toPixels` | `apps/web/game/layout/geometry.ts`<br>`Rect`, `itemBounds`, `seatPoint`, `overlaps`, `numberedDesks` | **No** | Shared geometry math is identical. However, `TILE` lives in `apps/web/game/constants.ts`, `SOLID` flags live in `apps/web/game/render/furniture.ts`, and wall collider math lives in `apps/web/game/render/walls.ts`. |
| `apps/api/src/office/layout/types.ts`<br>`FloorKind`, `RoomKind`, `Room`, `Wall`, `FURNITURE_KINDS`, `FurnitureKind`, `Furniture`, `OfficeLayout` | `apps/web/game/layout/types.ts`<br>`FloorKind`, `RoomKind`, `Room`, `Wall`, `FurnitureKind`, `Furniture`, `OfficeLayout`, `ZoneType`, `Zone` | **No** | API exports `FURNITURE_KINDS` runtime array. Web defines `FurnitureKind` as union string type directly and includes web-only game types (`Zone`, `ZoneType`). |
| `apps/api/src/office/layout/validate.ts`<br>`validateLayout`, `LayoutProblem`, `walkGrid`, `markBlocked` | `apps/web/game/editor/rules.ts`<br>`placementProblem`, `PlacementProblem`, `PROBLEM_TEXT` | **No** | Web checks physical placement rules (`outside`, `wall`, `overlap`, `notOnWall`) live during dragging. API runs full validation including 8 px walkability BFS for avatar reachability. |

### Web-only layout concepts

The web client contains components that have no backend equivalent:
- `apps/web/game/layout/derive.ts`:
  - `deriveZones(layout: OfficeLayout): Zone[]`: Computes runtime game zones (`'desk'`, `'meeting'`, `'chill'`) dynamically from placed desks and rooms. Desk zones take precedence over room zones.
  - `deriveLabels(layout: OfficeLayout)`: Computes room name text labels rendered on floors or hung on north wall faces.
- `apps/web/game/editor/LayoutEditor.ts`: Headless state container tracking undo/redo history stacks (`past`, `future`), multi-item selection boxes, and formatting the payload for `PUT /workspace/layout`.
- `apps/web/game/editor/EditMode.ts`: Phaser interaction layer handling mouse gestures, ghost item placement, rotation shortcuts, and selection graphics.
- `apps/web/game/editor/catalog.ts`: Palette catalog defining visual grouping categories (`'Work'`, `'Meetings'`, `'Lounge'`, `'Kitchen'`, `'Plants'`, `'Games'`) and default dimensions for the editor UI.

### Why there is no shared package

As configured in `docker-compose.yml`, Docker build contexts are scoped strictly per application directory:
- API build context: `./apps/api`
- Web build context: `./apps/web`

Because the Docker daemon cannot access files outside each service's build context directory without rearchitecting root-level multi-stage builds and monorepo workspace dependencies, shared modules cannot be imported across apps. Files must be mirrored directly and maintained in sync.

---

## 9. Why it's built this way

Rationale visible in codebase comments and structure:

1. **Layout stored as a single JSON blob**:
   Rather than normalizing rooms, walls, and furniture into separate relational database tables, the layout is stored as a single JSON column on `Workspace`. This eliminates dozens of table joins during workspace load and player join ticks, guarantees atomic layout reads/writes, enables simple optimistic version comparison (`layoutVersion`), and allows instant serialization for WebSocket broadcasts.
2. **Procedural wings with seeds instead of hand-drawn extensions**:
   Supporting arbitrary sequences of left, right, bottom, and chill wings with hand-drawn templates would require an exponential permutation of edge boundaries. Procedural wing planning allows infinite combinations while the deterministic PRNG seed (`seed:side:index`) guarantees repeatable output.
3. **Door placement by fewest removals**:
   When joining a wing to an active office, cutting a doorway through a shared wall could destroy furniture placed by users. The algorithm scans candidate positions, strictly protects essential functional furniture (`PROTECTED_KINDS`: desks, chairs, meeting tables, boards), and selects the opening that removes the minimum amount of non-essential solid furniture while centering on corridor aisles.
4. **Server-authoritative validation**:
   While the browser executes lightweight placement checks during drag gestures, server-side validation is authoritative. The server executes an 8 px grid reachability BFS ensuring that avatars can physically navigate from the entrance spawn to every desk and room. This prevents invalid or impassable layouts from ever persisting to the database.

---

## 10. How to change it safely

### Walk-through 1: Add a new furniture kind (e.g. `'aquarium'`)

1. **Backend Types**: In `apps/api/src/office/layout/types.ts`, add `'aquarium'` to the `FURNITURE_KINDS` array (which automatically extends `FurnitureKind`).
2. **Backend Geometry**: In `apps/api/src/office/layout/geometry.ts`, add `aquarium: true` (or `false` if walkable) to the `SOLID` record.
3. **Wall Mounting & Door Protection (if applicable)**:
   - If wall-mounted, add to `WALL_MOUNTED` in `apps/api/src/office/layout/mount.ts`.
   - If protected from doorway demolition, add to `PROTECTED_KINDS` in `apps/api/src/office/layout/wings.door.ts`.
4. **Frontend Types**: In `apps/web/game/layout/types.ts`, add `'aquarium'` to the `FurnitureKind` union type.
5. **Frontend Mounting (if applicable)**: If wall-mounted, update `apps/web/game/layout/mount.ts` to keep it byte-identical to the API.
6. **Frontend Catalog**: In `apps/web/game/editor/catalog.ts`, add an entry to `CATALOG` with default dimensions, label, group, and optional colors.
7. **Frontend Rendering**:
   - In `apps/web/game/render/furniture.ts`, implement the `DrawFn` drawing routines and register `aquarium` in `FURNITURE` with `solid`, `layer`, and `draw`.
   - In `apps/web/game/render/sprites.ts`, add to `VARIES` if sprite variants exist.
8. **Frontend UI Components**:
   - In `apps/web/features/office/EditorPanel.tsx`, add an icon mapping for the catalog palette.
   - In `apps/web/features/workspace/LayoutPreview.tsx`, add canvas preview rendering for the minimap.
9. **Snapshot Testing**: Run `npx vitest run apps/api/src/office/layout/layout.snapshot.spec.ts`. If new furniture is placed in default templates, update golden snapshots intentionally via `-u`.

### Walk-through 2: Add a new office template

1. **Template Definition**: Create `apps/api/src/office/templates/<name>.ts`. Implement a builder function returning `OfficeLayout` using `LayoutBuilder`.
2. **Template Registry**: In `apps/api/src/office/templates/index.ts`, import the new template and append an entry to `TEMPLATES` defining `id`, `name`, `description`, `minTeam`, `maxTeam`, and `build`.
3. **Run Template Tests**:
   - Run `npx vitest run apps/api/src/office/templates/templates.spec.ts`. This automatically tests all entries in `TEMPLATES` for layout validation, unique IDs, desk count, and board presence.
4. **Update Golden Snapshots**:
   - Run `npx vitest run apps/api/src/office/layout/layout.snapshot.spec.ts -u` to freeze the new template's output in `layout.snapshot.spec.ts.snap`.

---

## 11. Tests

The office layout subsystem is verified by the following spec suites:

- `apps/api/src/office/layout/layout.snapshot.spec.ts`: Golden snapshot tests freezing exact template outputs and multi-step wing chains (`[LEFT, LEFT, BOTTOM]`, `[RIGHT, BOTTOM, LEFT, RIGHT]`, `[BOTTOM, BOTTOM, RIGHT]`, chill wings) against `layout.snapshot.spec.ts.snap`.
- `apps/api/src/office/layout/validate.spec.ts`: Unit tests for `validateLayout` verifying `OUTSIDE`, `ON_WALL`, `NOT_ON_WALL`, `OVERLAP`, `SPAWN_BLOCKED`, `DESK_UNREACHABLE`, and `ROOM_UNREACHABLE`.
- `apps/api/src/office/layout/wings.spec.ts`: Unit tests for `addWing` validating expansion on all sides, multi-wing chains, randomized sequences of 6 wing sides, chill wings, and `NO_DOOR` error handling.
- `apps/api/src/office/layout/migrate.spec.ts`: Unit tests for `migrateWallMounted` verifying snapping unaligned wall items flush to walls within 8 tiles, dropping unmountable items, and confirming idempotence.
- `apps/api/src/office/templates/templates.spec.ts`: Parameterized tests across all `TEMPLATES` verifying zero editor rule violations, unique furniture IDs, adequate desk capacity, board counts, and loft chill room furnishings.
- `apps/api/src/office/templates/generated.spec.ts`: Tests for `generatedOffice` verifying scaling dimensions across team sizes, deterministic outputs for identical seed/team pairs, and aesthetic diversity across seeds.
- `apps/api/src/workspace/layout-migration.service.spec.ts`: Unit tests for `LayoutMigrationService.onModuleInit` verifying database scanning, migration updates, version increments, and error tolerance.
- `apps/api/src/workspace/desks.service.spec.ts`: Unit tests for `DesksService.move`, `assign`, and `sync` verifying desk validation, occupancy conflicts, handling Prisma unique constraint violations (`P2002`) as `DESK_TAKEN`, and event publishing.
- `apps/api/src/workspace/workspace-chill.spec.ts`: Integration tests for chill wing permissions (`canAddChill`), verifying access rules, template compatibility, and duplicate prevention (`CHILL_EXISTS`).

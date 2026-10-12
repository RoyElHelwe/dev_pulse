// Office layout validation verifying furniture boundaries, wall clearances,
// flush mounting, absence of overlaps, and character walkability.

import { itemBounds, numberedDesks, overlaps, type Rect, seatPoint, SOLID, TILE, toPixels, wallRect } from './geometry';
import { isWallMounted, mountWall } from './mount';
import type { Furniture, OfficeLayout } from './types';

/** Validation problem reported when an office layout violates physical or navigation rules. */
interface LayoutProblem {
  code: 'OUTSIDE' | 'ON_WALL' | 'OVERLAP' | 'SPAWN_BLOCKED' | 'DESK_UNREACHABLE' | 'ROOM_UNREACHABLE' | 'NOT_ON_WALL';
  message: string;
  /** Furniture to highlight in the editor. */
  itemIds: string[];
}

// The player's body (same as the game): 18 px wide, 10 px tall above the feet.
const BODY_HALF_W = 9; // pixels: half-width of the player's body
const BODY_H = 10; // pixels: height of the player's body above the feet
const CELL = 8; // pixels: walkability grid cell resolution
const OVERLAP_TOLERANCE = 0.1; // tiles: lets dividers touch desks
const EDGE_MARGIN_TILES = 0.1; // tiles: clearance required from building boundaries
const OBSTACLE_INSET_PX = 2; // pixels: obstacle shrink margin to prevent false positive wall overlaps
const SEAT_REACH_RADIUS_PX = TILE * 0.6; // pixels: search radius for reachable desk seating positions

/** Verifies that all furniture items stay strictly within the building boundaries. */
function checkInsideBuilding(layout: OfficeLayout, problems: LayoutProblem[]): void {
  for (const item of layout.furniture) {
    const b = itemBounds(item);
    if (
      b.x < EDGE_MARGIN_TILES ||
      b.y < EDGE_MARGIN_TILES ||
      b.x + b.w > layout.width - EDGE_MARGIN_TILES ||
      b.y + b.h > layout.height - EDGE_MARGIN_TILES
    ) {
      problems.push({ code: 'OUTSIDE', message: 'Furniture must be inside the building.', itemIds: [item.id] });
    }
  }
}

/** Verifies that standing furniture does not collide with room walls or doors. */
function checkNotOnWalls(solids: Furniture[], walls: Rect[], problems: LayoutProblem[]): void {
  for (const item of solids.filter((f) => f.kind !== 'board' && f.kind !== 'legoBoard')) {
    const px = shrink(toPixels(itemBounds(item)), OBSTACLE_INSET_PX);
    if (walls.some((w) => overlaps(px, w))) {
      problems.push({ code: 'ON_WALL', message: 'Furniture can’t stand on a wall or a door.', itemIds: [item.id] });
    }
  }
}

/** Verifies that wall-mounted items hang properly flush against a valid wall face. */
function checkWallMounted(layout: OfficeLayout, problems: LayoutProblem[]): void {
  for (const item of layout.furniture) {
    if (isWallMounted(item.kind) && mountWall(item, layout.walls) === null) {
      problems.push({
        code: 'NOT_ON_WALL',
        message: 'Boards, screens and the Lego wall must hang flush on a tall wall.',
        itemIds: [item.id],
      });
    }
  }
}

/** Checks for overlapping furniture pieces among solid items and wall-mounted items. */
function checkOverlaps(layout: OfficeLayout, solids: Furniture[], problems: LayoutProblem[]): void {
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      if (overlaps(itemBounds(solids[i]), itemBounds(solids[j]), OVERLAP_TOLERANCE)) {
        problems.push({ code: 'OVERLAP', message: 'Two pieces of furniture overlap.', itemIds: [solids[i].id, solids[j].id] });
      }
    }
  }

  const wallMounted = layout.furniture.filter((f) => isWallMounted(f.kind));
  for (let i = 0; i < wallMounted.length; i++) {
    for (let j = i + 1; j < wallMounted.length; j++) {
      const a = wallMounted[i];
      const b = wallMounted[j];
      if (SOLID[a.kind] && SOLID[b.kind]) continue;
      if (overlaps(itemBounds(a), itemBounds(b), OVERLAP_TOLERANCE)) {
        problems.push({ code: 'OVERLAP', message: 'Two pieces of furniture overlap.', itemIds: [a.id, b.id] });
      }
    }
  }
}

/** Checks that the entrance spawn, every desk, and every room are reachable on foot. */
function checkReachability(
  layout: OfficeLayout,
  walls: Rect[],
  solids: Furniture[],
  problems: LayoutProblem[],
): void {
  const grid = walkGrid(layout, [...walls, ...solids.map((s) => shrink(toPixels(itemBounds(s)), OBSTACLE_INSET_PX))]);
  const spawn = grid.cellAt(layout.spawn.x * TILE, layout.spawn.y * TILE);
  if (!grid.walkable(spawn)) {
    problems.push({ code: 'SPAWN_BLOCKED', message: 'The entrance is blocked.', itemIds: [] });
    return;
  }
  const reached = grid.reachableFrom(spawn);

  for (const { desk, name } of numberedDesks(layout)) {
    const seat = seatPoint(desk);
    if (!grid.anyReached(reached, seat.x * TILE, seat.y * TILE, SEAT_REACH_RADIUS_PX)) {
      problems.push({ code: 'DESK_UNREACHABLE', message: `Nobody can walk to ${name}.`, itemIds: [desk.id] });
    }
  }
  for (const room of layout.rooms) {
    const inside = grid.cellsIn(toPixels(room));
    if (!inside.some((c) => reached[c])) {
      problems.push({ code: 'ROOM_UNREACHABLE', message: `Nobody can walk into ${room.name}.`, itemIds: [] });
    }
  }
}

/** Checks that an office layout is valid: furniture inside bounds, not on walls, no overlaps, and reachable. */
export function validateLayout(layout: OfficeLayout): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const solids = layout.furniture.filter((f) => SOLID[f.kind]);
  const walls = layout.walls.map(wallRect);

  checkInsideBuilding(layout, problems);
  checkNotOnWalls(solids, walls, problems);
  checkWallMounted(layout, problems);
  checkOverlaps(layout, solids, problems);
  checkReachability(layout, walls, solids, problems);

  return problems;
}

/** Shrinks a rectangle symmetrically by a given pixel inset. */
function shrink(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y + by, w: r.w - by * 2, h: r.h - by * 2 };
}

// The feet-position grid tracks collision for character movement. A cell is blocked
// if the 18x10 px body standing there would touch an obstacle or building boundary.

/** Marks boundary margins and obstacle bounding boxes as blocked on the navigation grid. */
function markBlocked(
  blocked: Uint8Array,
  cols: number,
  rows: number,
  worldW: number,
  worldH: number,
  obstacles: Rect[],
): void {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * CELL;
      const y = (row + 0.5) * CELL;
      if (x < BODY_HALF_W || x > worldW - BODY_HALF_W || y < BODY_H || y > worldH) {
        blocked[row * cols + col] = 1;
      }
    }
  }

  for (const r of obstacles) {
    const c0 = Math.max(0, Math.floor((r.x - BODY_HALF_W) / CELL));
    const c1 = Math.min(cols - 1, Math.ceil((r.x + r.w + BODY_HALF_W) / CELL));
    const r0 = Math.max(0, Math.floor(r.y / CELL));
    const r1 = Math.min(rows - 1, Math.ceil((r.y + r.h + BODY_H) / CELL));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const x = (col + 0.5) * CELL;
        const y = (row + 0.5) * CELL;
        if (x > r.x - BODY_HALF_W && x < r.x + r.w + BODY_HALF_W && y > r.y && y < r.y + r.h + BODY_H) {
          blocked[row * cols + col] = 1;
        }
      }
    }
  }
}

/** Builds a feet-position walkability grid to test avatar navigation and reachability. */
function walkGrid(layout: OfficeLayout, obstacles: Rect[]) {
  const cols = Math.ceil((layout.width * TILE) / CELL);
  const rows = Math.ceil((layout.height * TILE) / CELL);
  const blocked = new Uint8Array(cols * rows);
  const worldW = layout.width * TILE;
  const worldH = layout.height * TILE;

  markBlocked(blocked, cols, rows, worldW, worldH, obstacles);

  const cellAt = (x: number, y: number) =>
    Math.min(rows - 1, Math.max(0, Math.floor(y / CELL))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x / CELL)));

  return {
    cellAt,
    walkable: (cell: number) => blocked[cell] === 0,
    reachableFrom(start: number) {
      const seen = new Uint8Array(cols * rows);
      const queue = [start];
      seen[start] = 1;
      while (queue.length) {
        const cell = queue.pop()!;
        const col = cell % cols;
        for (const next of [cell - cols, cell + cols, col > 0 ? cell - 1 : -1, col < cols - 1 ? cell + 1 : -1]) {
          if (next >= 0 && next < seen.length && !seen[next] && !blocked[next]) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
      return seen;
    },
    anyReached(seen: Uint8Array, x: number, y: number, radius: number) {
      for (let dy = -radius; dy <= radius; dy += CELL / 2) {
        for (let dx = -radius; dx <= radius; dx += CELL / 2) {
          if (seen[cellAt(x + dx, y + dy)]) return true;
        }
      }
      return false;
    },
    cellsIn(r: Rect) {
      const cells: number[] = [];
      for (let y = r.y + CELL / 2; y < r.y + r.h; y += CELL) {
        for (let x = r.x + CELL / 2; x < r.x + r.w; x += CELL) cells.push(cellAt(x, y));
      }
      return cells;
    },
  };
}

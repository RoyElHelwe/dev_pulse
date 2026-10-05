import { itemBounds, numberedDesks, overlaps, type Rect, seatPoint, SOLID, TILE, toPixels, wallRect } from './geometry';
import type { OfficeLayout } from './types';

export interface LayoutProblem {
  code: 'OUTSIDE' | 'ON_WALL' | 'OVERLAP' | 'SPAWN_BLOCKED' | 'DESK_UNREACHABLE' | 'ROOM_UNREACHABLE';
  message: string;
  /** Furniture to highlight in the editor. */
  itemIds: string[];
}

// The player's body (same as the game): 18 px wide, 10 px tall above the feet.
const BODY_HALF_W = 9;
const BODY_H = 10;
const CELL = 8; // walkability grid, in pixels
const OVERLAP_TOLERANCE = 0.1; // tiles: lets dividers touch desks

/**
 * Checks that an office still works after editing: furniture inside the
 * building, not on walls or on other furniture, and every desk and room
 * reachable on foot from the entrance.
 */
export function validateLayout(layout: OfficeLayout): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const solids = layout.furniture.filter((f) => SOLID[f.kind]);
  const walls = layout.walls.map(wallRect);

  for (const item of layout.furniture) {
    const b = itemBounds(item);
    if (b.x < 0.1 || b.y < 0.1 || b.x + b.w > layout.width - 0.1 || b.y + b.h > layout.height - 0.1) {
      problems.push({ code: 'OUTSIDE', message: 'Furniture must be inside the building.', itemIds: [item.id] });
    }
  }

  for (const item of solids) {
    const px = shrink(toPixels(itemBounds(item)), 2);
    if (walls.some((w) => overlaps(px, w))) {
      problems.push({ code: 'ON_WALL', message: 'Furniture can’t stand on a wall or a door.', itemIds: [item.id] });
    }
  }

  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      if (overlaps(itemBounds(solids[i]), itemBounds(solids[j]), OVERLAP_TOLERANCE)) {
        problems.push({ code: 'OVERLAP', message: 'Two pieces of furniture overlap.', itemIds: [solids[i].id, solids[j].id] });
      }
    }
  }

  const grid = walkGrid(layout, [...walls, ...solids.map((s) => shrink(toPixels(itemBounds(s)), 2))]);
  const spawn = grid.cellAt(layout.spawn.x * TILE, layout.spawn.y * TILE);
  if (!grid.walkable(spawn)) {
    problems.push({ code: 'SPAWN_BLOCKED', message: 'The entrance is blocked.', itemIds: [] });
    return problems;
  }
  const reached = grid.reachableFrom(spawn);

  for (const { desk, name } of numberedDesks(layout)) {
    const seat = seatPoint(desk);
    if (!grid.anyReached(reached, seat.x * TILE, seat.y * TILE, TILE * 0.6)) {
      problems.push({ code: 'DESK_UNREACHABLE', message: `Nobody can walk to ${name}.`, itemIds: [desk.id] });
    }
  }
  for (const room of layout.rooms) {
    const inside = grid.cellsIn(toPixels(room));
    if (!inside.some((c) => reached[c])) {
      problems.push({ code: 'ROOM_UNREACHABLE', message: `Nobody can walk into ${room.name}.`, itemIds: [] });
    }
  }
  return problems;
}

function shrink(r: Rect, by: number): Rect {
  return { x: r.x + by, y: r.y + by, w: r.w - by * 2, h: r.h - by * 2 };
}

/** Grid of feet positions where the player's body fits. */
function walkGrid(layout: OfficeLayout, obstacles: Rect[]) {
  const cols = Math.ceil((layout.width * TILE) / CELL);
  const rows = Math.ceil((layout.height * TILE) / CELL);
  const blocked = new Uint8Array(cols * rows);
  const worldW = layout.width * TILE;
  const worldH = layout.height * TILE;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * CELL;
      const y = (row + 0.5) * CELL;
      if (x < BODY_HALF_W || x > worldW - BODY_HALF_W || y < BODY_H || y > worldH) blocked[row * cols + col] = 1;
    }
  }
  // Mark every feet position where the body would touch an obstacle.
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

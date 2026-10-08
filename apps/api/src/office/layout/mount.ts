import type { Furniture, FurnitureKind, Wall } from './types';

// Wall-mounted kinds hang on the tall south-facing face of a solid horizontal wall
// instead of standing on the floor. Their 'footprint' (w x h) is a thin strip on the
// floor right in front of the wall, flush with its base line; the art is drawn on the
// face above it. Same file in apps/web/game/layout/mount.ts and apps/api/src/office/layout/mount.ts.

export const WALL_MOUNTED: ReadonlySet<FurnitureKind> = new Set<FurnitureKind>(['tv', 'board', 'legoBoard']);
export const isWallMounted = (kind: FurnitureKind) => WALL_MOUNTED.has(kind);

const TILE = 32;
const SOLID_THICKNESS = 10; // px, same as the wall's footprint (game/render/walls.ts)
/** How far (tiles) below the base line an item's top edge may sit and still count as hung on that wall. */
const MOUNT_SLACK = 0.5;
const EDGE = 0.05;

/** Base line (tiles) of a wall that shows a tall face on its south side, else null. */
export function faceBase(wall: Wall): number | null {
  if (wall.y1 !== wall.y2 || wall.kind !== 'solid' || wall.face === false) return null;
  return wall.y1 + SOLID_THICKNESS / 2 / TILE;
}

/** The wall the item hangs on, or null (not flush against a face, across a door gap, or rotated). */
export function mountWall(item: Furniture, walls: Wall[]): Wall | null {
  if (item.rotation) return null;
  const top = item.y - item.h / 2;
  for (const wall of walls) {
    const base = faceBase(wall);
    if (base === null) continue;
    const x0 = Math.min(wall.x1, wall.x2);
    const x1 = Math.max(wall.x1, wall.x2);
    if (item.x - item.w / 2 < x0 - EDGE || item.x + item.w / 2 > x1 + EDGE) continue;
    if (top >= base - EDGE && top <= base + MOUNT_SLACK) return wall;
  }
  return null;
}

/** The item moved flush onto the nearest wall face (within maxDistance tiles), or null when none fits. */
export function snapToWall<T extends Furniture>(item: T, walls: Wall[], maxDistance = 4): T | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (const wall of walls) {
    const base = faceBase(wall);
    if (base === null) continue;
    const x0 = Math.min(wall.x1, wall.x2);
    const x1 = Math.max(wall.x1, wall.x2);
    if (x1 - x0 < item.w) continue;
    const x = Math.min(x1 - item.w / 2, Math.max(x0 + item.w / 2, item.x));
    const y = base + item.h / 2;
    const distance = Math.hypot(x - item.x, y - item.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x, y };
    }
  }
  return best && bestDistance <= maxDistance ? { ...item, ...best, rotation: 0 } : null;
}

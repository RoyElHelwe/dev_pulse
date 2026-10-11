// Mirror of the placement checks in apps/api/src/office/layout/validate.ts (OUTSIDE, ON_WALL, NOT_ON_WALL, OVERLAP), run live while dragging; the API also checks reachability on save and is the authority.

import { TILE } from '../constants';
import { itemBounds, overlaps } from '../layout/geometry';
import { isWallMounted, mountWall } from '../layout/mount';
import type { Furniture, OfficeLayout } from '../layout/types';
import { FURNITURE } from '../render/furniture';
import { wallCollider } from '../render/walls';

const EDGE_MARGIN_TILES = 0.1;
const OVERLAP_TOLERANCE = 0.1;
const OBSTACLE_INSET_PX = 2;

/** Problem code when a piece of furniture violates a placement rule. */
export type PlacementProblem = 'outside' | 'wall' | 'overlap' | 'notOnWall';

/** User-facing explanation for each placement problem. */
export const PROBLEM_TEXT: Record<PlacementProblem, string> = {
  outside: 'It has to stay inside the building.',
  wall: 'It can’t stand on a wall or in a doorway.',
  overlap: 'It overlaps another piece of furniture.',
  notOnWall: 'Hang it flush on a tall wall.',
};

/** Tests whether an item can be placed, returning the first violated rule, or null. */
export function placementProblem(item: Furniture, layout: OfficeLayout, others: Furniture[]): PlacementProblem | null {
  const b = itemBounds(item);
  if (
    b.x < EDGE_MARGIN_TILES ||
    b.y < EDGE_MARGIN_TILES ||
    b.x + b.w > layout.width - EDGE_MARGIN_TILES ||
    b.y + b.h > layout.height - EDGE_MARGIN_TILES
  ) {
    return 'outside';
  }
  if (isWallMounted(item.kind)) {
    if (!mountWall(item, layout.walls)) return 'notOnWall';
    const hit = others.some((o) => o.id !== item.id && isWallMounted(o.kind) && overlaps(b, itemBounds(o), OVERLAP_TOLERANCE));
    return hit ? 'overlap' : null;
  }
  if (!FURNITURE[item.kind].solid) return null;
  const px = {
    x: b.x * TILE + OBSTACLE_INSET_PX,
    y: b.y * TILE + OBSTACLE_INSET_PX,
    w: b.w * TILE - OBSTACLE_INSET_PX * 2,
    h: b.h * TILE - OBSTACLE_INSET_PX * 2,
  };
  if (layout.walls.some((w) => overlaps(px, wallCollider(w)))) return 'wall';
  const hit = others.some((o) => o.id !== item.id && FURNITURE[o.kind].solid && overlaps(b, itemBounds(o), OVERLAP_TOLERANCE));
  return hit ? 'overlap' : null;
}

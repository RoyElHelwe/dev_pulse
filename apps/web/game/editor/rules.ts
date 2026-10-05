import { TILE } from '../constants';
import { itemBounds, type Rect } from '../layout/derive';
import type { Furniture, OfficeLayout } from '../layout/types';
import { FURNITURE } from '../render/furniture';
import { wallCollider } from '../render/walls';

// The same placement rules as the API (apps/api/src/office/layout/validate.ts),
// checked live while dragging. Reachability is checked by the API on save.

export type PlacementProblem = 'outside' | 'wall' | 'overlap';

export const PROBLEM_TEXT: Record<PlacementProblem, string> = {
  outside: 'It has to stay inside the building.',
  wall: 'It can’t stand on a wall or in a doorway.',
  overlap: 'It overlaps another piece of furniture.',
};

const overlaps = (a: Rect, b: Rect, margin = 0) =>
  a.x + margin < b.x + b.w && b.x + margin < a.x + a.w && a.y + margin < b.y + b.h && b.y + margin < a.y + a.h;

export function placementProblem(item: Furniture, layout: OfficeLayout, others: Furniture[]): PlacementProblem | null {
  const b = itemBounds(item);
  if (b.x < 0.1 || b.y < 0.1 || b.x + b.w > layout.width - 0.1 || b.y + b.h > layout.height - 0.1) return 'outside';
  if (!FURNITURE[item.kind].solid) return null;
  const px = { x: b.x * TILE + 2, y: b.y * TILE + 2, w: b.w * TILE - 4, h: b.h * TILE - 4 };
  if (layout.walls.some((w) => overlaps(px, wallCollider(w)))) return 'wall';
  const hit = others.some((o) => o.id !== item.id && FURNITURE[o.kind].solid && overlaps(b, itemBounds(o), 0.1));
  return hit ? 'overlap' : null;
}

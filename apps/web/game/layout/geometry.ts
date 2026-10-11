// Mirror of apps/api/src/office/layout/geometry.ts (Rect, itemBounds, seatPoint, numberedDesks, overlaps): change both together.
// They cannot share a package because the Docker build contexts are per app (see docs/code/layout.md).
// The api's TILE/SOLID/wallRect/toPixels live in game/constants.ts, render/furniture.ts and render/walls.ts here.

import type { Furniture, OfficeLayout } from './types';

/** Axis-aligned rectangle with position and dimensions. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounds of a (possibly rotated) item, in tiles. */
export function itemBounds(item: Pick<Furniture, 'x' | 'y' | 'w' | 'h' | 'rotation'>): Rect {
  const turned = item.rotation === 90 || item.rotation === 270;
  const w = turned ? item.h : item.w;
  const h = turned ? item.w : item.h;
  return { x: item.x - w / 2, y: item.y - h / 2, w, h };
}

/** Where the person sits at a desk: just in front of its user side. */
export function seatPoint(desk: Furniture) {
  const distance = desk.h / 2 + 0.45;
  const angle = ((desk.rotation ?? 0) * Math.PI) / 180;
  return { x: desk.x - Math.sin(angle) * distance, y: desk.y + Math.cos(angle) * distance };
}

/** Tests whether two axis-aligned rectangles intersect, with an optional inner margin tolerance. */
export function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a.x + margin < b.x + b.w && b.x + margin < a.x + a.w && a.y + margin < b.y + b.h && b.y + margin < a.y + a.h;
}

/** Desks in reading order: "Desk 1", "Desk 2"... (same numbering as the API). */
export function numberedDesks(layout: OfficeLayout) {
  return layout.furniture
    .filter((f) => f.kind === 'desk')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((desk, i) => ({ desk, name: `Desk ${i + 1}` }));
}

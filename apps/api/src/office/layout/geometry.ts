// Mirror of apps/web/game/layout/geometry.ts (itemBounds, seatPoint, numberedDesks, overlaps, Rect) and
// apps/web/game/constants.ts (TILE) plus apps/web/game/render/furniture.ts (solid flags = SOLID): change both together.
// They cannot share a package because the Docker build contexts are per app (see docs/code/layout.md).

import type { Furniture, FurnitureKind, OfficeLayout, Wall } from './types';

/** Size of a single grid tile in pixels. */
export const TILE = 32;
const WALL = { solid: { thickness: 10 }, glass: { thickness: 6 } };

/** Furniture you can't walk through (rugs, chairs, lamps... you can). */
export const SOLID: Record<FurnitureKind, boolean> = {
  desk: true,
  chair: false,
  divider: true,
  meetingTable: true,
  tv: false,
  board: true,
  sofa: true,
  armchair: true,
  coffeeTable: true,
  rug: false,
  plant: true,
  bookshelf: true,
  counter: true,
  fridge: true,
  barTable: true,
  stool: false,
  beanbag: true,
  floorLamp: false,
  foosball: true,
  cardTable: true,
  legoBoard: true,
};

/** Axis-aligned rectangle with position and dimensions. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounds of a (possibly rotated) item, in tiles. */
export function itemBounds(item: Furniture): Rect {
  const turned = item.rotation === 90 || item.rotation === 270;
  const w = turned ? item.h : item.w;
  const h = turned ? item.w : item.h;
  return { x: item.x - w / 2, y: item.y - h / 2, w, h };
}

/** Distance in tiles from a point (tiles) to an item's footprint (0 when standing on it). */
export function distanceToItem(x: number, y: number, item: Furniture): number {
  const b = itemBounds(item);
  const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
  const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

/** What blocks the player for a wall, in pixels: its footprint (the tall face is only drawn). */
export function wallRect(wall: Wall): Rect {
  const { thickness } = WALL[wall.kind];
  if (wall.y1 === wall.y2) {
    return {
      x: Math.min(wall.x1, wall.x2) * TILE,
      y: wall.y1 * TILE - thickness / 2,
      w: Math.abs(wall.x2 - wall.x1) * TILE,
      h: thickness,
    };
  }
  return {
    x: wall.x1 * TILE - thickness / 2,
    y: Math.min(wall.y1, wall.y2) * TILE - thickness / 2,
    w: thickness,
    h: Math.abs(wall.y2 - wall.y1) * TILE + thickness,
  };
}

/** Where the person sits at a desk (in tiles): just in front of its user side. */
export function seatPoint(desk: Furniture) {
  const distance = desk.h / 2 + 0.45;
  const angle = ((desk.rotation ?? 0) * Math.PI) / 180;
  // Local "south" (0, distance) rotated clockwise.
  return { x: desk.x - Math.sin(angle) * distance, y: desk.y + Math.cos(angle) * distance };
}

/** Tests whether two axis-aligned rectangles intersect, with an optional inner margin tolerance. */
export function overlaps(a: Rect, b: Rect, margin = 0) {
  return a.x + margin < b.x + b.w && b.x + margin < a.x + a.w && a.y + margin < b.y + b.h && b.y + margin < a.y + a.h;
}

/** Converts a rectangle with tile-based coordinates and dimensions into pixel units. */
export function toPixels(r: Rect): Rect {
  return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
}

/** Desks in reading order, numbered "Desk 1", "Desk 2"... */
export function numberedDesks(layout: OfficeLayout) {
  return layout.furniture
    .filter((f) => f.kind === 'desk')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((desk, i) => ({ desk, name: `Desk ${i + 1}` }));
}

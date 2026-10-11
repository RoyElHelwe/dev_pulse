/**
 * Room spatial query helpers.
 * Locates the specific room boundary containing a given world coordinate (in tiles).
 */

import type { OfficeLayout } from '../layout/types';

/**
 * "Which room is this point in?" Rooms can sit inside the open space, so the
 * smallest room containing the point wins. Coordinates in tiles.
 */
export function roomFinder(layout: OfficeLayout) {
  // Sort ascending by area so smaller nested rooms take precedence over larger enclosing ones.
  const rooms = [...layout.rooms].sort((a, b) => a.w * a.h - b.w * b.h);
  return (x: number, y: number) => rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.id ?? null;
}

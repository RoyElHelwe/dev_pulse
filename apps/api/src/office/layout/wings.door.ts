// Doorway location search and wall splitting helpers for connecting wings to an office.

import { itemBounds, overlaps, type Rect, SOLID } from './geometry';
import type { Furniture, Room, Wall } from './types';
import { type Span, WingError, type WingSide } from './wings.types';

/** Width of the doorway cut into the shared wall, in tiles. */
export const DOOR_WIDTH_TILES = 4;

/** Depth of the search strip perpendicular to the shared wall, in tiles. */
export const DOOR_STRIP_DEPTH_TILES = 3;

/** Width of the search strip along the shared wall, in tiles. */
export const DOOR_STRIP_WIDTH_TILES = 5.5;

/** Padding on each side of the doorway when building the search strip, in tiles. */
export const DOOR_STRIP_PAD_TILES = 0.75;

/** Step increment when sliding the doorway along the shared wall, in tiles. */
export const DOOR_STEP_TILES = 0.5;

/** Required clearance between the door and the ends of the wing open aisle, in tiles. */
export const DOOR_AISLE_MARGIN_TILES = 1;

/** Numerical tolerance for coordinate comparison and overlap tests. */
export const EPSILON = 1e-4;

/** Furniture kinds that must never be removed or blocked to place a door. */
export const PROTECTED_KINDS = new Set<string>([
  'desk',
  'chair',
  'meetingTable',
  'board',
  'foosball',
  'cardTable',
  'legoBoard',
]);

/** Result of selecting the best door placement on the shared wall. */
export interface DoorChoice {
  t: number;
  removableItems: Furniture[];
}

/** Tests whether two 1D intervals overlap by more than EPSILON. */
export function overlapsInterval(s1: number, e1: number, s2: number, e2: number): boolean {
  return Math.max(s1, s2) < Math.min(e1, e2) - EPSILON;
}

/** Finds gaps in walls along a coordinate axis within the given range. */
export function findWallGaps(
  walls: Wall[],
  orientation: 'HORIZONTAL' | 'VERTICAL',
  coord: number,
  rangeStart: number,
  rangeEnd: number,
): Array<{ start: number; end: number }> {
  const intervals: Array<{ start: number; end: number }> = [];

  for (const w of walls) {
    if (orientation === 'HORIZONTAL') {
      if (Math.abs(w.y1 - coord) < EPSILON && Math.abs(w.y2 - coord) < EPSILON) {
        const s = Math.max(rangeStart, Math.min(w.x1, w.x2));
        const e = Math.min(rangeEnd, Math.max(w.x1, w.x2));
        if (s < e) intervals.push({ start: s, end: e });
      }
    } else {
      if (Math.abs(w.x1 - coord) < EPSILON && Math.abs(w.x2 - coord) < EPSILON) {
        const s = Math.max(rangeStart, Math.min(w.y1, w.y2));
        const e = Math.min(rangeEnd, Math.max(w.y1, w.y2));
        if (s < e) intervals.push({ start: s, end: e });
      }
    }
  }

  intervals.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const int of intervals) {
    if (merged.length === 0 || merged[merged.length - 1].end < int.start - EPSILON) {
      merged.push({ ...int });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, int.end);
    }
  }

  const gaps: Array<{ start: number; end: number }> = [];
  let curr = rangeStart;
  for (const m of merged) {
    if (m.start > curr + EPSILON) {
      gaps.push({ start: curr, end: m.start });
    }
    curr = Math.max(curr, m.end);
  }
  if (curr < rangeEnd - EPSILON) {
    gaps.push({ start: curr, end: rangeEnd });
  }

  return gaps;
}

/** Splits collinear walls around a door opening. */
export function splitWallsForDoor(
  walls: Wall[],
  orientation: 'HORIZONTAL' | 'VERTICAL',
  coord: number,
  doorStart: number,
  doorEnd: number,
): Wall[] {
  const result: Wall[] = [];

  for (const w of walls) {
    const isCollinear =
      orientation === 'HORIZONTAL'
        ? Math.abs(w.y1 - coord) < EPSILON && Math.abs(w.y2 - coord) < EPSILON
        : Math.abs(w.x1 - coord) < EPSILON && Math.abs(w.x2 - coord) < EPSILON;

    if (!isCollinear) {
      result.push(w);
      continue;
    }

    const p1 = orientation === 'HORIZONTAL' ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
    const p2 = orientation === 'HORIZONTAL' ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);

    if (Math.max(p1, doorStart) >= Math.min(p2, doorEnd) - EPSILON) {
      result.push(w);
      continue;
    }

    if (doorStart > p1 + EPSILON) {
      if (orientation === 'HORIZONTAL') {
        result.push({ x1: p1, y1: coord, x2: doorStart, y2: coord, kind: w.kind, face: w.face });
      } else {
        result.push({ x1: coord, y1: p1, x2: coord, y2: doorStart, kind: w.kind, face: w.face });
      }
    }

    if (p2 > doorEnd + EPSILON) {
      if (orientation === 'HORIZONTAL') {
        result.push({ x1: doorEnd, y1: coord, x2: p2, y2: coord, kind: w.kind, face: w.face });
      } else {
        result.push({ x1: coord, y1: doorEnd, x2: coord, y2: p2, kind: w.kind, face: w.face });
      }
    }
  }

  return result;
}

function roomSpanOnShared(
  room: Room,
  orientation: 'HORIZONTAL' | 'VERTICAL',
  sharedCoord: number,
): Span | null {
  if (room.kind !== 'open') return null;
  if (orientation === 'VERTICAL') {
    const touches = Math.abs(room.x - sharedCoord) < EPSILON || Math.abs(room.x + room.w - sharedCoord) < EPSILON;
    return touches ? { start: room.y, end: room.y + room.h } : null;
  }
  const touches = Math.abs(room.y + room.h - sharedCoord) < EPSILON;
  return touches ? { start: room.x, end: room.x + room.w } : null;
}

function doorCandidateStrip(
  orientation: 'HORIZONTAL' | 'VERTICAL',
  sharedCoord: number,
  isLeft: boolean,
  t: number,
): Rect {
  if (orientation === 'VERTICAL') {
    const stripX = isLeft ? sharedCoord : sharedCoord - DOOR_STRIP_DEPTH_TILES;
    return { x: stripX, y: t - DOOR_STRIP_PAD_TILES, w: DOOR_STRIP_DEPTH_TILES, h: DOOR_STRIP_WIDTH_TILES };
  }
  return { x: t - DOOR_STRIP_PAD_TILES, y: sharedCoord - DOOR_STRIP_DEPTH_TILES, w: DOOR_STRIP_WIDTH_TILES, h: DOOR_STRIP_DEPTH_TILES };
}

function testDoorCandidateStrip(
  strip: Rect,
  furniture: Furniture[],
): { valid: boolean; removableItems: Furniture[] } {
  const removableItems: Furniture[] = [];
  for (const f of furniture) {
    const fb = itemBounds(f);
    if (overlaps(strip, fb)) {
      if (PROTECTED_KINDS.has(f.kind)) {
        return { valid: false, removableItems: [] };
      }
      if (SOLID[f.kind]) {
        removableItems.push(f);
      }
    }
  }
  return { valid: true, removableItems };
}

/** Finds the optimal doorway position connecting the wing to an adjacent open room. */
export function chooseDoor(
  side: WingSide,
  sharedCoord: number,
  wingOpenAisle: Span,
  shiftedRooms: Room[],
  shiftedFurniture: Furniture[],
  rand: () => number,
): DoorChoice {
  const isBottom = side === 'BOTTOM';
  const isLeft = side === 'LEFT';
  const orientation = isBottom ? 'HORIZONTAL' : 'VERTICAL';
  const candidates: Array<{ t: number; removals: number; removableItems: Furniture[]; distToMid: number }> = [];

  for (const oldRoom of shiftedRooms) {
    const span = roomSpanOnShared(oldRoom, orientation, sharedCoord);
    if (!span) continue;

    const minT = Math.max(wingOpenAisle.start + DOOR_AISLE_MARGIN_TILES, span.start);
    const maxT = Math.min(wingOpenAisle.end - DOOR_AISLE_MARGIN_TILES, span.end) - DOOR_WIDTH_TILES;
    if (minT > maxT) continue;

    const midT = (minT + maxT) / 2;
    for (let t = minT; t <= maxT + 1e-6; t += DOOR_STEP_TILES) {
      const roundedT = Math.round(t * 2) / 2;
      const strip = doorCandidateStrip(orientation, sharedCoord, isLeft, roundedT);
      const { valid, removableItems } = testDoorCandidateStrip(strip, shiftedFurniture);
      if (valid) {
        candidates.push({
          t: roundedT,
          removals: removableItems.length,
          removableItems,
          distToMid: Math.abs(roundedT - midT),
        });
      }
    }
  }

  if (candidates.length === 0) {
    const sideName = side.toLowerCase();
    throw new WingError(
      'NO_DOOR',
      `There is no free spot on the ${sideName} wall for a doorway. Move some furniture away from that wall and try again.`,
    );
  }

  candidates.sort((a, b) => {
    if (a.removals !== b.removals) return a.removals - b.removals;
    if (Math.abs(a.distToMid - b.distToMid) > EPSILON) return a.distToMid - b.distToMid;
    return rand() - 0.5;
  });

  return { t: candidates[0].t, removableItems: candidates[0].removableItems };
}

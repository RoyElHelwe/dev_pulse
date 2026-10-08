import { itemBounds, overlaps, type Rect, SOLID } from './geometry';
import type { Furniture, FurnitureKind, OfficeLayout, Room, Wall } from './types';
import { validateLayout } from './validate';
import { LayoutBuilder } from '../templates/builder';

export type WingSide = 'LEFT' | 'RIGHT' | 'BOTTOM';
export interface WingInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  deskCount: number;
}
export interface WingResult {
  layout: OfficeLayout;
  wing: WingInfo;
  shift: { x: number; y: number };
}
export class WingError extends Error {
  constructor(
    public code: 'NO_DOOR' | 'WING_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'WingError';
  }
}

const CARPETS = [0x7d8796, 0x8b8478, 0x6f7f74, 0x7b7489, 0x8a7f8f, 0x6e7c86];
const SOFAS = [0x5f7a6b, 0x3d5a80, 0x6b5b7a, 0x8a5a44];

const MEETING_NAMES = ['Huddle', 'Studio', 'War room', 'Board room'];
const LOUNGE_NAMES = ['Lounge', 'Kitchen', 'Garden', 'Library'];
const OPEN_NAMES = ['Open space', 'Workroom', 'Commons', 'Workspace'];

const PROTECTED_KINDS = new Set<string>(['desk', 'chair', 'meetingTable', 'board', 'foosball', 'cardTable', 'legoBoard']);

export interface AddWingOptions {
  special?: 'chill';
}

export function addWing(
  layout: OfficeLayout,
  side: WingSide,
  seed: string,
  index: number,
  options?: AddWingOptions,
): WingResult {
  const isChill = options?.special === 'chill';
  const rand = seededRandom(`${seed}:${side}:${index}`);

  const origW = layout.width;
  const origH = layout.height;

  const isLeft = side === 'LEFT';
  const isRight = side === 'RIGHT';
  const isBottom = side === 'BOTTOM';

  const depth = isBottom ? 17 : 13;
  const shift = { x: isLeft ? depth : 0, y: 0 };

  const newW = isBottom ? origW : origW + depth;
  const newH = isBottom ? origH + depth : origH;

  // Clone existing elements and shift if LEFT
  const shiftedRooms: Room[] = layout.rooms.map((r) => ({
    ...r,
    x: r.x + shift.x,
  }));
  const shiftedWalls: Wall[] = layout.walls.map((w) => ({
    ...w,
    x1: w.x1 + shift.x,
    x2: w.x2 + shift.x,
  }));
  const shiftedFurniture: Furniture[] = layout.furniture.map((f) => ({
    ...f,
    x: f.x + shift.x,
  }));
  let newSpawn = {
    x: layout.spawn.x + shift.x,
    y: layout.spawn.y + shift.y,
  };

  const wingX = isRight ? origW : 0;
  const wingY = isBottom ? origH : 0;
  const wingW = isBottom ? origW : depth;
  const wingH = isBottom ? depth : origH;

  // Decide extra room kind and names
  const isMeeting = rand() < 0.5;
  const extraKind = isMeeting ? 'meeting' : 'lounge';
  const extraFloor = isMeeting ? 'carpet' : 'terrazzo';
  const extraColor = isMeeting ? pick(CARPETS, rand) : undefined;
  const extraName = pick(isMeeting ? MEETING_NAMES : LOUNGE_NAMES, rand);
  const openFloor = rand() < 0.5 ? 'oak' : 'carpet';
  const openName = pick(OPEN_NAMES, rand);

  const b = new LayoutBuilder(`w${index}-`);
  const wingRooms: Room[] = [];
  const wingWalls: Wall[] = [];

  let wingOpenAisle: { start: number; end: number };
  let wingOpenSpanAlongShared: { start: number; end: number };
  let extraSpanAlongShared: { start: number; end: number };
  const sharedCoord = isLeft ? depth : isRight ? origW : origH;

  if (isLeft || isRight) {
    if (isChill) {
      const chillRoomId = layout.rooms.some((r) => r.id === 'chill') ? `wing${index}-chill` : 'chill';
      wingRooms.push({
        id: chillRoomId,
        name: 'Chill room',
        kind: 'chill',
        x: wingX,
        y: 0,
        w: depth,
        h: origH,
        floor: 'terrazzo',
      });

      extraSpanAlongShared = { start: 0, end: 0 };
      wingOpenSpanAlongShared = { start: 1, end: origH - 1 };
      wingOpenAisle = { start: 1, end: origH - 1 };

      if (isLeft) {
        b.chillRoom(0, 0, 9, origH);
        wingWalls.push({ x1: wingX, y1: 0, x2: wingX + depth, y2: 0, kind: 'solid' });
        wingWalls.push({ x1: 0, y1: 0, x2: 0, y2: origH, kind: 'solid' });
        wingWalls.push({ x1: 0, y1: origH, x2: depth, y2: origH, kind: 'solid', face: false });
      } else {
        b.chillRoom(wingX + 4, 0, 9, origH);
        wingWalls.push({ x1: wingX, y1: 0, x2: wingX + depth, y2: 0, kind: 'solid' });
        wingWalls.push({ x1: wingX + depth, y1: 0, x2: wingX + depth, y2: origH, kind: 'solid' });
        wingWalls.push({ x1: wingX, y1: origH, x2: wingX + depth, y2: origH, kind: 'solid', face: false });
      }
    } else {
      const R = Math.min(16, Math.max(12, Math.round(origH - 14)));

      // Extra room at north end
      wingRooms.push({
        id: `wing${index}-extra`,
        name: extraName,
        kind: extraKind,
        x: wingX,
        y: 0,
        w: depth,
        h: R,
        floor: extraFloor,
        color: extraColor,
      });

      // Open room below extra room
      wingRooms.push({
        id: `wing${index}-open`,
        name: openName,
        kind: 'open',
        x: wingX,
        y: R,
        w: depth,
        h: origH - R,
        floor: openFloor,
      });

      extraSpanAlongShared = { start: 0, end: R };
      wingOpenSpanAlongShared = { start: R, end: origH };
      wingOpenAisle = { start: R, end: origH };

      // Extra room furniture
      if (isMeeting) {
        b.meetingRoom(wingX, depth, 5, 0);
      } else {
        const loungeVariant = rand() < 0.5 ? 'chill' : 'kitchen';
        if (loungeVariant === 'chill') {
          b.chillCorner(wingX + depth / 2, pick(SOFAS, rand), 0);
        } else {
          b.kitchen(wingX + 1, 5, 0);
          b.barTable(wingX + depth / 2, 6.5);
          b.add({ kind: 'plant', x: wingX + 1.2, y: 10.8, w: 1, h: 1 });
        }
      }

      // Glass wall between extra room and open room with 3-wide door
      const doorGapX = isLeft ? 9.5 : wingX + 0.5;
      wingWalls.push(
        { x1: wingX, y1: R, x2: doorGapX, y2: R, kind: 'glass' },
        { x1: doorGapX + 3, y1: R, x2: wingX + depth, y2: R, kind: 'glass' },
      );

      // Open room clusters stacked vertically
      // Keep cluster >= 3.05 from outer wall so future wings on the same side are not blocked,
      // leaving a 2.85 aisle along the shared wall.
      const clusterOx = isLeft ? wingX + 3.05 : wingX + 2.85;
      const oy1 = R + 0.8;
      const oy2 = R + 7.0;
      b.deskCluster(clusterOx, oy1);
      b.deskCluster(clusterOx, oy2);

      // Leftover space plant along outer wall
      if (isLeft) {
        b.add({ kind: 'plant', x: 1.0, y: origH - 1.2, w: 1.1, h: 1.1 });
      } else {
        b.add({ kind: 'plant', x: wingX + depth - 1.0, y: origH - 1.2, w: 1.1, h: 1.1 });
      }

      // Outer walls of the wing
      wingWalls.push({ x1: wingX, y1: 0, x2: wingX + depth, y2: 0, kind: 'solid' });
      if (isLeft) {
        wingWalls.push({ x1: 0, y1: 0, x2: 0, y2: origH, kind: 'solid' });
        wingWalls.push({ x1: 0, y1: origH, x2: depth, y2: origH, kind: 'solid', face: false });
      } else {
        wingWalls.push({ x1: wingX + depth, y1: 0, x2: wingX + depth, y2: origH, kind: 'solid' });
        wingWalls.push({ x1: wingX, y1: origH, x2: wingX + depth, y2: origH, kind: 'solid', face: false });
      }
    }
  } else {
    // BOTTOM wing
    if (isChill) {
      const chillRoomId = layout.rooms.some((r) => r.id === 'chill') ? `wing${index}-chill` : 'chill';
      wingRooms.push({
        id: chillRoomId,
        name: 'Chill room',
        kind: 'chill',
        x: 0,
        y: origH,
        w: origW,
        h: depth,
        floor: 'terrazzo',
      });

      extraSpanAlongShared = { start: 0, end: 12 };
      wingOpenSpanAlongShared = { start: 12, end: origW - 1 };
      wingOpenAisle = { start: 12, end: origW - 1 };

      b.chillRoom(0, origH, origW, depth);
      wingWalls.push(
        { x1: 0, y1: origH, x2: 0, y2: origH + depth, kind: 'solid' },
        { x1: origW, y1: origH, x2: origW, y2: origH + depth, kind: 'solid' },
        { x1: 0, y1: origH + depth, x2: origW, y2: origH + depth, kind: 'solid', face: false },
      );
    } else {
      // Choose west or east end for extra room based on pre-existing gaps on shared wall
      const gapsOnShared = findWallGaps(shiftedWalls, 'HORIZONTAL', origH, 0, origW);
      const westGaps = gapsOnShared.filter((g) => overlapsInterval(g.start, g.end, 0, 14)).length;
      const eastGaps = gapsOnShared.filter((g) => overlapsInterval(g.start, g.end, origW - 14, origW)).length;

      let isWest: boolean;
      if (westGaps < eastGaps) isWest = true;
      else if (eastGaps < westGaps) isWest = false;
      else isWest = rand() < 0.5;

      const extraX = isWest ? 0 : origW - 14;
      const openX = isWest ? 14 : 0;
      const openW = origW - 14;

      wingRooms.push({
        id: `wing${index}-extra`,
        name: extraName,
        kind: extraKind,
        x: extraX,
        y: origH,
        w: 14,
        h: depth,
        floor: extraFloor,
        color: extraColor,
      });

      wingRooms.push({
        id: `wing${index}-open`,
        name: openName,
        kind: 'open',
        x: openX,
        y: origH,
        w: openW,
        h: depth,
        floor: openFloor,
      });

      extraSpanAlongShared = { start: extraX, end: extraX + 14 };
      wingOpenSpanAlongShared = { start: openX, end: openX + openW };
      wingOpenAisle = { start: openX, end: openX + openW };

      // Extra room furniture
      if (isMeeting) {
        b.meetingRoom(extraX, 14, 5, origH);
      } else {
        const loungeVariant = rand() < 0.5 ? 'chill' : 'kitchen';
        if (loungeVariant === 'chill') {
          b.chillCorner(extraX + 7, pick(SOFAS, rand), origH);
        } else {
          b.kitchen(extraX + 1, 5, origH);
          b.barTable(extraX + 7, origH + 6.5);
          b.add({ kind: 'plant', x: extraX + 1.2, y: origH + 10.8, w: 1, h: 1 });
        }
      }

      // Dividing wall between extra room and open room
      const divX = isWest ? 14 : origW - 14;
      const divDoorY = isWest ? origH + 0.5 : origH + 3.0;
      wingWalls.push(
        { x1: divX, y1: origH, x2: divX, y2: divDoorY, kind: 'glass' },
        { x1: divX, y1: divDoorY + 3, x2: divX, y2: origH + depth, kind: 'glass' },
      );

      // Open room clusters centred below north aisle
      const clusterOy = origH + 4.5;
      const clusterGap = Math.min(3.0, Math.max(1.4, (openW - 14.2) / 3));
      const totalClusterW = 14.2 + clusterGap;
      const clusterLeft = openX + (openW - totalClusterW) / 2;
      b.deskCluster(clusterLeft, clusterOy);
      b.deskCluster(clusterLeft + 7.1 + clusterGap, clusterOy);

      // Entrance on outer south wall
      const entranceX = openX + openW / 2;
      wingWalls.push(
        { x1: 0, y1: origH + depth, x2: 0, y2: origH, kind: 'solid' },
        { x1: origW, y1: origH + depth, x2: origW, y2: origH, kind: 'solid' },
        { x1: 0, y1: origH + depth, x2: entranceX - 2, y2: origH + depth, kind: 'solid', face: false },
        { x1: entranceX + 2, y1: origH + depth, x2: origW, y2: origH + depth, kind: 'solid', face: false },
      );

      b.doormat(entranceX, origH + depth);
      newSpawn = { x: entranceX, y: origH + depth - 2.5 };
    }
  }

  // Convert old south wall to interior wall for BOTTOM
  if (isBottom) {
    for (const w of shiftedWalls) {
      if (w.y1 === origH && w.y2 === origH && w.face === false) {
        delete w.face;
      }
    }
  }

  // Seal pre-existing gaps where shared wall adjoins extra room
  const gapsInExtra = findWallGaps(
    shiftedWalls,
    isBottom ? 'HORIZONTAL' : 'VERTICAL',
    sharedCoord,
    extraSpanAlongShared.start,
    extraSpanAlongShared.end,
  );
  for (const gap of gapsInExtra) {
    if (isBottom) {
      shiftedWalls.push({ x1: gap.start, y1: sharedCoord, x2: gap.end, y2: sharedCoord, kind: 'solid' });
    } else {
      shiftedWalls.push({ x1: sharedCoord, y1: gap.start, x2: sharedCoord, y2: gap.end, kind: 'solid' });
    }
  }

  // Door position search on the shared wall
  const candidates: Array<{
    t: number;
    removals: number;
    removableItems: Furniture[];
    distToMid: number;
  }> = [];

  const orientation = isBottom ? 'HORIZONTAL' : 'VERTICAL';

  for (const oldRoom of shiftedRooms) {
    if (oldRoom.kind !== 'open') continue;
    let rTouches = false;
    let rSpanStart = 0;
    let rSpanEnd = 0;

    if (orientation === 'VERTICAL') {
      rTouches = Math.abs(oldRoom.x - sharedCoord) < 1e-4 || Math.abs(oldRoom.x + oldRoom.w - sharedCoord) < 1e-4;
      rSpanStart = oldRoom.y;
      rSpanEnd = oldRoom.y + oldRoom.h;
    } else {
      rTouches = Math.abs(oldRoom.y + oldRoom.h - sharedCoord) < 1e-4;
      rSpanStart = oldRoom.x;
      rSpanEnd = oldRoom.x + oldRoom.w;
    }
    if (!rTouches) continue;

    // Door span [t, t + 4] must be fully inside both open rooms and clear of aisle ends by >= 1
    const minT = Math.max(wingOpenAisle.start + 1, rSpanStart);
    const maxT = Math.min(wingOpenAisle.end - 1, rSpanEnd) - 4;
    if (minT > maxT) continue;

    const midT = (minT + maxT) / 2;

    for (let t = minT; t <= maxT + 1e-6; t += 0.5) {
      const roundedT = Math.round(t * 2) / 2;

      let strip: Rect;
      if (orientation === 'VERTICAL') {
        const stripX = isLeft ? sharedCoord : sharedCoord - 3;
        strip = { x: stripX, y: roundedT - 0.75, w: 3, h: 5.5 };
      } else {
        strip = { x: roundedT - 0.75, y: sharedCoord - 3, w: 5.5, h: 3 };
      }

      let valid = true;
      const removableItems: Furniture[] = [];

      for (const f of shiftedFurniture) {
        const fb = itemBounds(f);
        if (overlaps(strip, fb)) {
          if (PROTECTED_KINDS.has(f.kind)) {
            valid = false;
            break;
          }
          if (SOLID[f.kind]) {
            removableItems.push(f);
          }
        }
      }

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

  // Sort candidates by fewest removals, ties by nearest to middle of allowed range, then seeded tie-break
  candidates.sort((a, b) => {
    if (a.removals !== b.removals) return a.removals - b.removals;
    if (Math.abs(a.distToMid - b.distToMid) > 1e-4) return a.distToMid - b.distToMid;
    return rand() - 0.5;
  });

  const best = candidates[0];

  // Remove non-protected solid furniture in strip
  const finalShiftedFurniture = shiftedFurniture.filter(
    (f) => !best.removableItems.some((rem) => rem.id === f.id),
  );

  // Cut 4-tile door gap in shared wall
  const doorSpanStart = best.t;
  const doorSpanEnd = best.t + 4;
  const cutWalls = splitWallsForDoor(shiftedWalls, orientation, sharedCoord, doorSpanStart, doorSpanEnd);

  const resultLayout: OfficeLayout = {
    width: newW,
    height: newH,
    rooms: [...shiftedRooms, ...wingRooms],
    walls: [...cutWalls, ...wingWalls],
    furniture: [...finalShiftedFurniture, ...b.furniture],
    spawn: newSpawn,
    ...(layout.generated ? { generated: layout.generated } : {}),
  };

  const problems = validateLayout(resultLayout);
  if (problems.length > 0) {
    throw new WingError('WING_INVALID', problems[0].message);
  }

  return {
    layout: resultLayout,
    wing: {
      x: wingX,
      y: wingY,
      w: wingW,
      h: wingH,
      deskCount: isChill ? 0 : 8,
    },
    shift,
  };
}

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function overlapsInterval(s1: number, e1: number, s2: number, e2: number): boolean {
  return Math.max(s1, s2) < Math.min(e1, e2) - 1e-4;
}

function findWallGaps(
  walls: Wall[],
  orientation: 'HORIZONTAL' | 'VERTICAL',
  coord: number,
  rangeStart: number,
  rangeEnd: number,
): Array<{ start: number; end: number }> {
  const intervals: Array<{ start: number; end: number }> = [];

  for (const w of walls) {
    if (orientation === 'HORIZONTAL') {
      if (Math.abs(w.y1 - coord) < 1e-4 && Math.abs(w.y2 - coord) < 1e-4) {
        const s = Math.max(rangeStart, Math.min(w.x1, w.x2));
        const e = Math.min(rangeEnd, Math.max(w.x1, w.x2));
        if (s < e) intervals.push({ start: s, end: e });
      }
    } else {
      if (Math.abs(w.x1 - coord) < 1e-4 && Math.abs(w.x2 - coord) < 1e-4) {
        const s = Math.max(rangeStart, Math.min(w.y1, w.y2));
        const e = Math.min(rangeEnd, Math.max(w.y1, w.y2));
        if (s < e) intervals.push({ start: s, end: e });
      }
    }
  }

  intervals.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const int of intervals) {
    if (merged.length === 0 || merged[merged.length - 1].end < int.start - 1e-4) {
      merged.push({ ...int });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, int.end);
    }
  }

  const gaps: Array<{ start: number; end: number }> = [];
  let curr = rangeStart;
  for (const m of merged) {
    if (m.start > curr + 1e-4) {
      gaps.push({ start: curr, end: m.start });
    }
    curr = Math.max(curr, m.end);
  }
  if (curr < rangeEnd - 1e-4) {
    gaps.push({ start: curr, end: rangeEnd });
  }

  return gaps;
}

function splitWallsForDoor(
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
        ? Math.abs(w.y1 - coord) < 1e-4 && Math.abs(w.y2 - coord) < 1e-4
        : Math.abs(w.x1 - coord) < 1e-4 && Math.abs(w.x2 - coord) < 1e-4;

    if (!isCollinear) {
      result.push(w);
      continue;
    }

    const p1 = orientation === 'HORIZONTAL' ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
    const p2 = orientation === 'HORIZONTAL' ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);

    // Overlaps door gap?
    if (Math.max(p1, doorStart) >= Math.min(p2, doorEnd) - 1e-4) {
      result.push(w);
      continue;
    }

    // Part before door
    if (doorStart > p1 + 1e-4) {
      if (orientation === 'HORIZONTAL') {
        result.push({ x1: p1, y1: coord, x2: doorStart, y2: coord, kind: w.kind, face: w.face });
      } else {
        result.push({ x1: coord, y1: p1, x2: coord, y2: doorStart, kind: w.kind, face: w.face });
      }
    }

    // Part after door
    if (p2 > doorEnd + 1e-4) {
      if (orientation === 'HORIZONTAL') {
        result.push({ x1: doorEnd, y1: coord, x2: p2, y2: coord, kind: w.kind, face: w.face });
      } else {
        result.push({ x1: coord, y1: doorEnd, x2: coord, y2: p2, kind: w.kind, face: w.face });
      }
    }
  }

  return result;
}

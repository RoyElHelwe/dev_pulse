// Room, wall, and furniture planning for newly generated office wings.

import { LayoutBuilder } from '../templates/builder';
import { CARPETS, SOFAS } from '../templates/palette';
import { pick } from './random';
import type { Room, Wall } from './types';
import { findWallGaps, overlapsInterval } from './wings.door';
import type { WingPlan, WingSide } from './wings.types';

/** Depth of side wings added to the left or right of the office, in tiles. */
export const SIDE_WING_DEPTH = 13;

/** Depth of wings added to the bottom of the office, in tiles. */
export const BOTTOM_WING_DEPTH = 17;

/** Width of the extra room in a bottom wing, in tiles. */
export const BOTTOM_EXTRA_ROOM_W = 14;

/** Minimum height of the extra room in a side wing, in tiles. */
export const SIDE_EXTRA_ROOM_MIN_H = 12;

/** Maximum height of the extra room in a side wing, in tiles. */
export const SIDE_EXTRA_ROOM_MAX_H = 16;

/** Target clearance from the south wall for side wing extra room height calculation. */
export const SIDE_EXTRA_ROOM_CLEARANCE = 14;

/** Left cluster offset in a left side wing to preserve aisle and clearance. */
export const CLUSTER_MARGIN_LEFT = 3.05;

/** Right cluster offset in a right side wing to preserve aisle and clearance. */
export const CLUSTER_MARGIN_RIGHT = 2.85;

/** Width of a standard desk cluster, in tiles. */
export const CLUSTER_W = 7.1;

/** Number of desks added by a standard working wing. */
export const DESKS_PER_WING = 8;

const MEETING_NAMES = ['Huddle', 'Studio', 'War room', 'Board room'];
const LOUNGE_NAMES = ['Lounge', 'Kitchen', 'Garden', 'Library'];
const OPEN_NAMES = ['Open space', 'Workroom', 'Commons', 'Workspace'];

/** Visual theme and naming choices for a new wing. */
export interface WingLook {
  isMeeting: boolean;
  extraKind: 'meeting' | 'lounge';
  extraFloor: 'carpet' | 'terrazzo';
  extraColor?: number;
  extraName: string;
  openFloor: 'oak' | 'carpet';
  openName: string;
}

/** Randomly picks names, floorings, and theme for a new wing. */
export function pickWingLook(rand: () => number): WingLook {
  const isMeeting = rand() < 0.5;
  const extraKind = isMeeting ? 'meeting' : 'lounge';
  const extraFloor = isMeeting ? 'carpet' : 'terrazzo';
  const extraColor = isMeeting ? pick(CARPETS, rand) : undefined;
  const extraName = pick(isMeeting ? MEETING_NAMES : LOUNGE_NAMES, rand);
  const openFloor = rand() < 0.5 ? 'oak' : 'carpet';
  const openName = pick(OPEN_NAMES, rand);
  return { isMeeting, extraKind, extraFloor, extraColor, extraName, openFloor, openName };
}

/** Populates furniture for the extra room (meeting room or lounge variant). */
export function furnishExtraRoom(
  b: LayoutBuilder,
  look: WingLook,
  rect: { x: number; y: number; w: number },
  rand: () => number,
): void {
  if (look.isMeeting) {
    b.meetingRoom(rect.x, rect.w, 5, rect.y);
  } else {
    const loungeVariant = rand() < 0.5 ? 'chill' : 'kitchen';
    if (loungeVariant === 'chill') {
      b.chillCorner(rect.x + rect.w / 2, pick(SOFAS, rand), rect.y);
    } else {
      b.kitchen(rect.x + 1, 5, rect.y);
      b.barTable(rect.x + rect.w / 2, rect.y + 6.5);
      b.add({ kind: 'plant', x: rect.x + 1.2, y: rect.y + 10.8, w: 1, h: 1 });
    }
  }
}

function sideOuterWalls(side: 'LEFT' | 'RIGHT', wingX: number, depth: number, origH: number): Wall[] {
  const walls: Wall[] = [{ x1: wingX, y1: 0, x2: wingX + depth, y2: 0, kind: 'solid' }];
  if (side === 'LEFT') {
    walls.push(
      { x1: 0, y1: 0, x2: 0, y2: origH, kind: 'solid' },
      { x1: 0, y1: origH, x2: depth, y2: origH, kind: 'solid', face: false },
    );
  } else {
    walls.push(
      { x1: wingX + depth, y1: 0, x2: wingX + depth, y2: origH, kind: 'solid' },
      { x1: wingX, y1: origH, x2: wingX + depth, y2: origH, kind: 'solid', face: false },
    );
  }
  return walls;
}

function bottomOuterWalls(origW: number, origH: number, depth: number, entranceX: number): Wall[] {
  return [
    { x1: 0, y1: origH + depth, x2: 0, y2: origH, kind: 'solid' },
    { x1: origW, y1: origH + depth, x2: origW, y2: origH, kind: 'solid' },
    { x1: 0, y1: origH + depth, x2: entranceX - 2, y2: origH + depth, kind: 'solid', face: false },
    { x1: entranceX + 2, y1: origH + depth, x2: origW, y2: origH + depth, kind: 'solid', face: false },
  ];
}

function pickBottomOrientation(
  shiftedWalls: Wall[],
  origW: number,
  origH: number,
  rand: () => number,
): boolean {
  const gapsOnShared = findWallGaps(shiftedWalls, 'HORIZONTAL', origH, 0, origW);
  const westGaps = gapsOnShared.filter((g) => overlapsInterval(g.start, g.end, 0, BOTTOM_EXTRA_ROOM_W)).length;
  const eastGaps = gapsOnShared.filter((g) => overlapsInterval(g.start, g.end, origW - BOTTOM_EXTRA_ROOM_W, origW)).length;

  if (westGaps < eastGaps) return true;
  if (eastGaps < westGaps) return false;
  return rand() < 0.5;
}

/** Plans a chill room wing (dedicated relaxation space with terrazzo floor). */
export function planChillWing(
  side: WingSide,
  index: number,
  origW: number,
  origH: number,
  depth: number,
  wingX: number,
  existingRooms: Room[],
): WingPlan {
  const b = new LayoutBuilder(`w${index}-`);
  const chillRoomId = existingRooms.some((r) => r.id === 'chill') ? `wing${index}-chill` : 'chill';

  if (side === 'LEFT' || side === 'RIGHT') {
    const isLeft = side === 'LEFT';
    if (isLeft) {
      b.chillRoom(0, 0, 9, origH);
    } else {
      b.chillRoom(wingX + 4, 0, 9, origH);
    }
    return {
      rooms: [{ id: chillRoomId, name: 'Chill room', kind: 'chill', x: wingX, y: 0, w: depth, h: origH, floor: 'terrazzo' }],
      walls: sideOuterWalls(side, wingX, depth, origH),
      furniture: b,
      extraSpan: { start: 0, end: 0 },
      openSpan: { start: 1, end: origH - 1 },
      openAisle: { start: 1, end: origH - 1 },
    };
  }

  b.chillRoom(0, origH, origW, depth);
  return {
    rooms: [{ id: chillRoomId, name: 'Chill room', kind: 'chill', x: 0, y: origH, w: origW, h: depth, floor: 'terrazzo' }],
    walls: [
      { x1: 0, y1: origH, x2: 0, y2: origH + depth, kind: 'solid' },
      { x1: origW, y1: origH, x2: origW, y2: origH + depth, kind: 'solid' },
      { x1: 0, y1: origH + depth, x2: origW, y2: origH + depth, kind: 'solid', face: false },
    ],
    furniture: b,
    extraSpan: { start: 0, end: 12 },
    openSpan: { start: 12, end: origW - 1 },
    openAisle: { start: 12, end: origW - 1 },
  };
}

/** Plans a side wing (LEFT or RIGHT) containing an extra room and stacked desk clusters. */
export function planSideWing(
  side: 'LEFT' | 'RIGHT',
  index: number,
  origH: number,
  depth: number,
  wingX: number,
  look: WingLook,
  rand: () => number,
): WingPlan {
  const isLeft = side === 'LEFT';
  const b = new LayoutBuilder(`w${index}-`);
  const R = Math.min(
    SIDE_EXTRA_ROOM_MAX_H,
    Math.max(SIDE_EXTRA_ROOM_MIN_H, Math.round(origH - SIDE_EXTRA_ROOM_CLEARANCE)),
  );

  const wingRooms: Room[] = [
    { id: `wing${index}-extra`, name: look.extraName, kind: look.extraKind, x: wingX, y: 0, w: depth, h: R, floor: look.extraFloor, color: look.extraColor },
    { id: `wing${index}-open`, name: look.openName, kind: 'open', x: wingX, y: R, w: depth, h: origH - R, floor: look.openFloor },
  ];

  furnishExtraRoom(b, look, { x: wingX, y: 0, w: depth }, rand);

  const doorGapX = isLeft ? 9.5 : wingX + 0.5;
  const wingWalls: Wall[] = [
    { x1: wingX, y1: R, x2: doorGapX, y2: R, kind: 'glass' },
    { x1: doorGapX + 3, y1: R, x2: wingX + depth, y2: R, kind: 'glass' },
    ...sideOuterWalls(side, wingX, depth, origH),
  ];

  // Open room clusters stacked vertically
  // Keep cluster >= 3.05 from outer wall so future wings on the same side are not blocked,
  // leaving a 2.85 aisle along the shared wall.
  const clusterOx = isLeft ? wingX + CLUSTER_MARGIN_LEFT : wingX + CLUSTER_MARGIN_RIGHT;
  b.deskCluster(clusterOx, R + 0.8);
  b.deskCluster(clusterOx, R + 7.0);

  const plantX = isLeft ? 1.0 : wingX + depth - 1.0;
  b.add({ kind: 'plant', x: plantX, y: origH - 1.2, w: 1.1, h: 1.1 });

  return {
    rooms: wingRooms,
    walls: wingWalls,
    furniture: b,
    extraSpan: { start: 0, end: R },
    openSpan: { start: R, end: origH },
    openAisle: { start: R, end: origH },
  };
}

/** Plans a bottom wing extending south with an extra room, open area, and outer entrance. */
export function planBottomWing(
  index: number,
  origW: number,
  origH: number,
  depth: number,
  shiftedWalls: Wall[],
  look: WingLook,
  rand: () => number,
): WingPlan {
  const b = new LayoutBuilder(`w${index}-`);
  const isWest = pickBottomOrientation(shiftedWalls, origW, origH, rand);

  const extraX = isWest ? 0 : origW - BOTTOM_EXTRA_ROOM_W;
  const openX = isWest ? BOTTOM_EXTRA_ROOM_W : 0;
  const openW = origW - BOTTOM_EXTRA_ROOM_W;

  const wingRooms: Room[] = [
    { id: `wing${index}-extra`, name: look.extraName, kind: look.extraKind, x: extraX, y: origH, w: BOTTOM_EXTRA_ROOM_W, h: depth, floor: look.extraFloor, color: look.extraColor },
    { id: `wing${index}-open`, name: look.openName, kind: 'open', x: openX, y: origH, w: openW, h: depth, floor: look.openFloor },
  ];

  furnishExtraRoom(b, look, { x: extraX, y: origH, w: BOTTOM_EXTRA_ROOM_W }, rand);

  const divX = isWest ? BOTTOM_EXTRA_ROOM_W : origW - BOTTOM_EXTRA_ROOM_W;
  const divDoorY = isWest ? origH + 0.5 : origH + 3.0;
  const entranceX = openX + openW / 2;
  const wingWalls: Wall[] = [
    { x1: divX, y1: origH, x2: divX, y2: divDoorY, kind: 'glass' },
    { x1: divX, y1: divDoorY + 3, x2: divX, y2: origH + depth, kind: 'glass' },
    ...bottomOuterWalls(origW, origH, depth, entranceX),
  ];

  const clusterOy = origH + 4.5;
  const clusterGap = Math.min(3.0, Math.max(1.4, (openW - 2 * CLUSTER_W) / 3));
  const totalClusterW = 2 * CLUSTER_W + clusterGap;
  const clusterLeft = openX + (openW - totalClusterW) / 2;
  b.deskCluster(clusterLeft, clusterOy);
  b.deskCluster(clusterLeft + CLUSTER_W + clusterGap, clusterOy);

  b.doormat(entranceX, origH + depth);

  return {
    rooms: wingRooms,
    walls: wingWalls,
    furniture: b,
    extraSpan: { start: extraX, end: extraX + BOTTOM_EXTRA_ROOM_W },
    openSpan: { start: openX, end: openX + openW },
    openAisle: { start: openX, end: openX + openW },
    spawn: { x: entranceX, y: origH + depth - 2.5 },
  };
}

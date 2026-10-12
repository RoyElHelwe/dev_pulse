// Grows the building by one wing on LEFT, RIGHT, or BOTTOM through six pipeline steps:
// frame -> shift existing -> plan wing rooms/walls/furniture -> seal gaps ->
// cut a 4-tile door in the shared wall at the position removing least furniture -> validate.

import type { Furniture, OfficeLayout, Room, Wall } from './types';
import { validateLayout } from './validate';
import { seededRandom } from './random';
import { chooseDoor, DOOR_WIDTH_TILES, findWallGaps, splitWallsForDoor } from './wings.door';
import {
  BOTTOM_WING_DEPTH,
  DESKS_PER_WING,
  pickWingLook,
  planBottomWing,
  planChillWing,
  planSideWing,
  SIDE_WING_DEPTH,
  type WingLook,
} from './wings.plan';
import {
  type AddWingOptions,
  type Span,
  WingError,
  type WingPlan,
  type WingResult,
  type WingSide,
} from './wings.types';

export type { WingSide, WingResult, AddWingOptions } from './wings.types';
export { WingError } from './wings.types';

/** Bounding box, shift offset, and shared wall coordinates for an attached wing. */
interface WingFrame {
  /** Depth of the newly added wing in tiles. */
  depth: number;
  /** Shift applied to all existing layout coordinates. */
  shift: { x: number; y: number };
  /** Total building width after attaching the wing. */
  newW: number;
  /** Total building height after attaching the wing. */
  newH: number;
  /** X origin of the new wing bounding box. */
  wingX: number;
  /** Y origin of the new wing bounding box. */
  wingY: number;
  /** Width of the new wing bounding box. */
  wingW: number;
  /** Height of the new wing bounding box. */
  wingH: number;
  /** Coordinate of the shared boundary between the existing office and the wing. */
  sharedCoord: number;
}

/** Computes the geometric frame, shift offset, and shared boundary for an attached wing. */
function computeWingFrame(layout: OfficeLayout, side: WingSide): WingFrame {
  const isLeft = side === 'LEFT';
  const isRight = side === 'RIGHT';
  const isBottom = side === 'BOTTOM';

  const depth = isBottom ? BOTTOM_WING_DEPTH : SIDE_WING_DEPTH;
  // Building origin is top-left (0, 0), so growing west moves existing content east by the wing depth.
  const shift = { x: isLeft ? depth : 0, y: 0 };

  return {
    depth,
    shift,
    newW: isBottom ? layout.width : layout.width + depth,
    newH: isBottom ? layout.height + depth : layout.height,
    wingX: isRight ? layout.width : 0,
    wingY: isBottom ? layout.height : 0,
    wingW: isBottom ? layout.width : depth,
    wingH: isBottom ? depth : layout.height,
    sharedCoord: isLeft ? depth : isRight ? layout.width : layout.height,
  };
}

/** Translates existing rooms, walls, and furniture coordinates by the given frame offset. */
function shiftExisting(layout: OfficeLayout, shift: { x: number; y: number }) {
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
  return { shiftedRooms, shiftedWalls, shiftedFurniture };
}

/** Generates room layouts, walls, and furniture for the attached wing, prefixing furniture IDs with w<index>-. */
function planWing(
  side: WingSide,
  isChill: boolean,
  index: number,
  layout: OfficeLayout,
  frame: WingFrame,
  shiftedWalls: Wall[],
  look: WingLook,
  rand: () => number,
): WingPlan {
  // Furniture IDs are prefixed with w<index>- across wing planners to ensure uniqueness across wings.
  if (isChill) {
    return planChillWing(side, index, layout.width, layout.height, frame.depth, frame.wingX, layout.rooms);
  }
  if (side === 'BOTTOM') {
    return planBottomWing(index, layout.width, layout.height, frame.depth, shiftedWalls, look, rand);
  }
  return planSideWing(side, index, layout.height, frame.depth, frame.wingX, look, rand);
}

/** Converts exterior walls to interior walls and seals gaps adjacent to extra rooms. */
function prepareSharedWall(
  shiftedWalls: Wall[],
  side: WingSide,
  origH: number,
  sharedCoord: number,
  extraSpan: Span,
): void {
  const isBottom = side === 'BOTTOM';

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
    extraSpan.start,
    extraSpan.end,
  );
  for (const gap of gapsInExtra) {
    if (isBottom) {
      shiftedWalls.push({ x1: gap.start, y1: sharedCoord, x2: gap.end, y2: sharedCoord, kind: 'solid' });
    } else {
      shiftedWalls.push({ x1: sharedCoord, y1: gap.start, x2: sharedCoord, y2: gap.end, kind: 'solid' });
    }
  }
}

/** Finds the optimal door position along the shared wall and splits walls around the opening. */
function cutSharedDoor(
  side: WingSide,
  sharedCoord: number,
  openAisle: Span,
  shiftedRooms: Room[],
  shiftedWalls: Wall[],
  shiftedFurniture: Furniture[],
  rand: () => number,
): { cutWalls: Wall[]; finalFurniture: Furniture[] } {
  const { t, removableItems } = chooseDoor(side, sharedCoord, openAisle, shiftedRooms, shiftedFurniture, rand);
  const finalFurniture = shiftedFurniture.filter((f) => !removableItems.some((rem) => rem.id === f.id));
  const cutWalls = splitWallsForDoor(
    shiftedWalls,
    side === 'BOTTOM' ? 'HORIZONTAL' : 'VERTICAL',
    sharedCoord,
    t,
    t + DOOR_WIDTH_TILES,
  );
  return { cutWalls, finalFurniture };
}

/** Combines shifted layout elements with new wing assets and validates the combined office. */
function assembleAndValidate(
  layout: OfficeLayout,
  frame: WingFrame,
  plan: WingPlan,
  shiftedRooms: Room[],
  cutWalls: Wall[],
  finalFurniture: Furniture[],
): OfficeLayout {
  const resultLayout: OfficeLayout = {
    width: frame.newW,
    height: frame.newH,
    rooms: [...shiftedRooms, ...plan.rooms],
    walls: [...cutWalls, ...plan.walls],
    furniture: [...finalFurniture, ...plan.furniture.furniture],
    spawn: plan.spawn ?? { x: layout.spawn.x + frame.shift.x, y: layout.spawn.y + frame.shift.y },
    ...(layout.generated ? { generated: layout.generated } : {}),
  };

  const problems = validateLayout(resultLayout);
  if (problems.length > 0) {
    throw new WingError('WING_INVALID', problems[0].message);
  }
  return resultLayout;
}

/** Extends an existing office layout with an attached wing on the left, right, or bottom. */
export function addWing(
  layout: OfficeLayout,
  side: WingSide,
  seed: string,
  index: number,
  options?: AddWingOptions,
): WingResult {
  const isChill = options?.special === 'chill';
  const rand = seededRandom(`${seed}:${side}:${index}`);

  // 1. Wing frame
  const frame = computeWingFrame(layout, side);

  // 2. Shift existing elements
  const { shiftedRooms, shiftedWalls, shiftedFurniture } = shiftExisting(layout, frame.shift);

  // 3. Plan the wing
  const look = pickWingLook(rand);
  const plan = planWing(side, isChill, index, layout, frame, shiftedWalls, look, rand);

  // 4. Open shared wall bits
  prepareSharedWall(shiftedWalls, side, layout.height, frame.sharedCoord, plan.extraSpan);

  // 5. Choose door, remove blocking furniture, cut door in shared wall
  const { cutWalls, finalFurniture } = cutSharedDoor(
    side,
    frame.sharedCoord,
    plan.openAisle,
    shiftedRooms,
    shiftedWalls,
    shiftedFurniture,
    rand,
  );

  // 6. Assemble and validate
  const resultLayout = assembleAndValidate(layout, frame, plan, shiftedRooms, cutWalls, finalFurniture);

  return {
    layout: resultLayout,
    wing: {
      x: frame.wingX,
      y: frame.wingY,
      w: frame.wingW,
      h: frame.wingH,
      deskCount: isChill ? 0 : DESKS_PER_WING,
    },
    shift: frame.shift,
  };
}

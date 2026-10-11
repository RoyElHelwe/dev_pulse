/**
 * Pure domain logic and geometry rules for the Lego wall minigame (48x32 board).
 * Handles brick validation, bounds checks, collision detection, and board state mutations without I/O.
 */

import { Budget } from '../../office/office.rules';

/** Total board width in studs. */
export const BOARD_W = 48;
export const BOARD_W_STUDS = BOARD_W;

/** Total board height in studs. */
export const BOARD_H = 32;
export const BOARD_H_STUDS = BOARD_H;

/** Total allowed palette colors (0-15). */
export const PALETTE_SIZE = 16;
export const PALETTE_COLOR_COUNT = PALETTE_SIZE;

/** Maximum possible 1x1 bricks on a board (48 * 32). */
export const MAX_BOARD_BRICKS = BOARD_W * BOARD_H;

/** Allowed player rate limit: at most 15 actions per second. */
export const ACTION_RATE_LIMIT_PER_SEC = 15;

/** Brick tuple representation: [x, y, width, height, colorIndex]. */
export type Brick = [x: number, y: number, w: number, h: number, c: number];

/** Allowed brick footprint dimensions (width x height in studs). */
export const ALLOWED_SIZES: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [1, 4],
  [4, 1],
  [2, 4],
  [4, 2],
] as const;

/** Checks if a given brick width and height matches one of the allowed brick presets. */
function isAllowedSize(w: number, h: number): boolean {
  return ALLOWED_SIZES.some(([sw, sh]) => sw === w && sh === h);
}

/** Checks whether two rectangular bricks intersect or overlap on the grid. */
export function bricksOverlap(a: Brick, b: Brick): boolean {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  return !(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay);
}

/** Finds the brick covering coordinate (x, y), if one exists. */
export function brickAt(bricks: Brick[], x: number, y: number): Brick | undefined {
  return bricks.find(
    ([bx, by, bw, bh]) => bx <= x && x < bx + bw && by <= y && y < by + bh,
  );
}

/** Returns the index of the brick covering coordinate (x, y), or -1 if empty. */
export function findBrickIndex(bricks: Brick[], x: number, y: number): number {
  return bricks.findIndex(
    ([bx, by, bw, bh]) => bx <= x && x < bx + bw && by <= y && y < by + bh,
  );
}

/**
 * Validates whether a candidate brick can be placed on the current board.
 * Returns an error message string if invalid, or null if valid.
 */
export function validatePlace(bricks: Brick[], brick: Brick): string | null {
  if (
    !Array.isArray(brick) ||
    brick.length !== 5 ||
    !brick.every((n) => typeof n === 'number' && Number.isInteger(n))
  ) {
    return 'Invalid brick coordinates or dimensions';
  }

  const [x, y, w, h, c] = brick;

  if (!isAllowedSize(w, h)) {
    return `Invalid brick size (${w}x${h})`;
  }

  if (c < 0 || c >= PALETTE_SIZE) {
    return `Invalid color index (${c})`;
  }

  if (x < 0 || x + w > BOARD_W || y < 0 || y + h > BOARD_H) {
    return 'Brick is out of bounds';
  }

  const hasOverlap = bricks.some((existing) => bricksOverlap(existing, brick));
  if (hasOverlap) {
    return 'Brick overlaps with an existing brick';
  }

  return null;
}

/**
 * Parses and sanitizes brick data from JSON or raw array.
 * Drops malformed, out-of-bounds, invalid-sized, or overlapping bricks.
 */
export function parseBricks(json: unknown): Brick[] {
  let data = json;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) {
    return [];
  }

  const validBricks: Brick[] = [];

  for (const item of data) {
    if (
      !Array.isArray(item) ||
      item.length !== 5 ||
      !item.every((n) => typeof n === 'number' && Number.isInteger(n))
    ) {
      continue;
    }

    const [x, y, w, h, c] = item;
    if (!isAllowedSize(w, h)) continue;
    if (c < 0 || c >= PALETTE_SIZE) continue;
    if (x < 0 || x + w > BOARD_W || y < 0 || y + h > BOARD_H) continue;

    const candidate: Brick = [x, y, w, h, c];
    const overlaps = validBricks.some((existing) => bricksOverlap(existing, candidate));
    if (!overlaps) {
      validBricks.push(candidate);
    }
  }

  return validBricks;
}

/**
 * Pure brick placement returning a new brick list with the placed brick appended.
 */
export function placeBrick(bricks: Brick[], brick: Brick): Brick[] {
  return [...bricks, brick];
}

/**
 * Removes the brick covering coordinate (x, y) if present.
 * Returns the updated brick array and a boolean indicating whether a brick was removed.
 */
export function removeBrickAt(
  bricks: Brick[],
  x: number,
  y: number,
): { nextBricks: Brick[]; removed: boolean } {
  const index = findBrickIndex(bricks, x, y);
  if (index === -1) {
    return { nextBricks: bricks, removed: false };
  }
  const nextBricks = [...bricks];
  nextBricks.splice(index, 1);
  return { nextBricks, removed: true };
}

/**
 * Checks whether a user role possesses clearance to clear the entire Lego board.
 * WHY: Only workspace OWNER or ADMIN can clear the whole board to prevent griefing.
 */
export function canClearBoard(role?: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Creates a rate limit budget instance configured for Lego player actions.
 */
export function createActionBudget(): Budget {
  return new Budget(ACTION_RATE_LIMIT_PER_SEC);
}

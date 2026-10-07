export const BOARD_W = 48;
export const BOARD_H = 32;
export const PALETTE_SIZE = 16;

export type Brick = [x: number, y: number, w: number, h: number, c: number];

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

export function isAllowedSize(w: number, h: number): boolean {
  return ALLOWED_SIZES.some(([sw, sh]) => sw === w && sh === h);
}

export function bricksOverlap(a: Brick, b: Brick): boolean {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  return !(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay);
}

export function brickAt(bricks: Brick[], x: number, y: number): Brick | undefined {
  return bricks.find(
    ([bx, by, bw, bh]) => bx <= x && x < bx + bw && by <= y && y < by + bh,
  );
}

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

/**
 * Lego art board data structures, validation rules, client store, and canvas rendering.
 * Coordinates in drawLegoWall are local canvas pixels centered at (0, 0).
 */
import type * as Phaser from 'phaser';
import { circle, rr } from './draw';

/** Represents a placed Lego brick as [x, y, width, height, paletteIndex] in stud grid units. */
export type LegoBrick = [x: number, y: number, w: number, h: number, c: number];

/** Total width of the Lego board grid in studs. */
export const LEGO_W = 48;

/** Total height of the Lego board grid in studs. */
export const LEGO_H = 32;

/** Available Lego brick color hex strings indexed by color ID. */
export const LEGO_PALETTE = [
  '#ffffff', // 0: White
  '#9ca3af', // 1: Light gray
  '#4b5563', // 2: Dark gray
  '#18181b', // 3: Black
  '#ef4444', // 4: Red
  '#3b82f6', // 5: Blue
  '#eab308', // 6: Yellow
  '#22c55e', // 7: Green
  '#f97316', // 8: Orange
  '#854d0e', // 9: Brown
  '#d4b996', // 10: Tan
  '#84cc16', // 11: Lime
  '#06b6d4', // 12: Light Blue
  '#a855f7', // 13: Purple
  '#ec4899', // 14: Pink
  '#991b1b', // 15: Dark Red
] as const;

const LEGO_SIZES: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [1, 4],
  [4, 1],
  [2, 4],
  [4, 2],
] as const;

/** Standard allowable brick dimensions [width, height] in studs for user placement. */
export const LEGO_BASE_SHAPES: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, 2],
  [2, 2],
  [1, 4],
  [2, 4],
] as const;

function isAllowedSize(w: number, h: number): boolean {
  return LEGO_SIZES.some(([sw, sh]) => sw === w && sh === h);
}

/** Finds the brick covering the given stud grid coordinate (x, y), if any. */
export function brickAt(bricks: LegoBrick[], x: number, y: number): LegoBrick | undefined {
  return bricks.find(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh);
}

function bricksOverlap(
  b1: { x: number; y: number; w: number; h: number },
  b2: { x: number; y: number; w: number; h: number },
): boolean {
  return !(b1.x + b1.w <= b2.x || b2.x + b2.w <= b1.x || b1.y + b1.h <= b2.y || b2.y + b2.h <= b1.y);
}

/** Validates whether a brick placement is within grid bounds, has valid dimensions, and doesn't overlap existing bricks. */
export function validatePlacement(bricks: LegoBrick[], brick: LegoBrick): string | null {
  const [x, y, w, h, c] = brick;
  if (!isAllowedSize(w, h)) return 'Invalid brick size';
  if (x < 0 || y < 0 || x + w > LEGO_W || y + h > LEGO_H) return 'Out of bounds';
  if (c < 0 || c >= LEGO_PALETTE.length) return 'Invalid color';
  const target = { x, y, w, h };
  if (bricks.some(([bx, by, bw, bh]) => bricksOverlap(target, { x: bx, y: by, w: bw, h: bh }))) {
    return 'Overlaps existing brick';
  }
  return null;
}

interface BoardData {
  bricks: LegoBrick[];
  version: number;
}

const EMPTY: LegoBrick[] = [];
const boards = new Map<string, BoardData>();
const subscribers = new Set<(objectId: string) => void>();

/** Centralized client store and change emitter for office Lego board artwork. */
export const legoArt = {
  /** Set once the server's boards arrived: boards without art are then empty, not the placeholder. */
  loaded: false,
  /** Marks board state as initialized from server and triggers subscribers. */
  markLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    for (const sub of subscribers) sub('');
  },
  /** Returns current bricks for an object ID, or empty array if loaded. */
  get(objectId: string): LegoBrick[] | undefined {
    return boards.get(objectId)?.bricks ?? (this.loaded ? EMPTY : undefined);
  },
  /** Updates brick list for an object ID and notifies subscribers. */
  set(objectId: string, bricks: LegoBrick[]): void {
    const current = boards.get(objectId);
    const version = (current?.version ?? 0) + 1;
    boards.set(objectId, { bricks: [...bricks], version });
    for (const sub of subscribers) {
      try {
        sub(objectId);
      } catch {
        // Listener error isolated
      }
    }
  },
  /** Returns change version counter for the given object ID. */
  version(objectId: string): number {
    return boards.get(objectId)?.version ?? 0;
  },
  /** Registers a change listener called whenever any board is updated. */
  subscribe(cb: (objectId: string) => void): () => void {
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
    };
  },
};

const METAL_DARK = 0x262a2e;
const FRAME_BEVEL_COLOR = 0x3e454f;
const BASEPLATE_GREEN = 0x15803d;
const STUD_HIGHLIGHT_COLOR = 0x22c55e;
const STUD_SPACING_PX = 4;
const STUD_RADIUS_PX = 0.8;
const STUD_ALPHA = 0.5;
const BOARD_INSET_W_PX = 4;
const BOARD_INSET_H_PX = 3;
const BASEPLATE_OFFSET_Y_PX = 1.5;

/** Renders a Lego art board and its placed bricks onto a Phaser Graphics target. */
export function drawLegoWall(g: Phaser.GameObjects.Graphics, w: number, h: number, bricks: LegoBrick[]) {
  // Dark frame
  rr(g, -w / 2, -h / 2, w, h, 2, METAL_DARK);
  g.fillStyle(FRAME_BEVEL_COLOR, 1);
  g.fillRect(-w / 2 + 1, -h / 2, w - 2, 1);

  // Green Lego baseplate
  const bw = w - BOARD_INSET_W_PX;
  const bh = h - BOARD_INSET_H_PX;
  const bx = -bw / 2;
  const by = -h / 2 + BASEPLATE_OFFSET_Y_PX;
  rr(g, bx, by, bw, bh, 1, BASEPLATE_GREEN);

  // Stud grid across the baseplate
  const cols = Math.floor((bw - STUD_SPACING_PX) / STUD_SPACING_PX);
  const rows = Math.floor((bh - STUD_SPACING_PX) / STUD_SPACING_PX);
  const ox = bx + (bw - cols * STUD_SPACING_PX) / 2;
  const oy = by + (bh - rows * STUD_SPACING_PX) / 2;
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r <= rows; r++) {
      circle(g, ox + c * STUD_SPACING_PX, oy + r * STUD_SPACING_PX, STUD_RADIUS_PX, STUD_HIGHLIGHT_COLOR, STUD_ALPHA);
    }
  }

  // Draw bricks scaled to the baseplate rect (non-uniform scale)
  const studW = bw / LEGO_W;
  const studH = bh / LEGO_H;
  for (const [bxStud, byStud, bwStud, bhStud, c] of bricks) {
    const hex = LEGO_PALETTE[c] ?? LEGO_PALETTE[0];
    const colorNum = parseInt(hex.slice(1), 16);
    g.fillStyle(colorNum, 1);
    g.fillRect(bx + bxStud * studW, by + byStud * studH, bwStud * studW, bhStud * studH);
  }
}

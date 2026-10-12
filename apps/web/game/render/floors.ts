/**
 * Procedural floor pattern rendering for rooms (oak planks, carpet tiles, terrazzo).
 * Floor coordinates are converted from tile coordinates into world pixels.
 */
import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Room } from '../layout/types';
import { seededRandom, shade, type Random } from './draw';

type G = Phaser.GameObjects.Graphics;

// Oak plank floor constants
const OAK_BASE_COLOR = 0xdcc29e;
const OAK_PLANK_HEIGHT_PX = 12;
const OAK_OFFSET_JITTER_PX = 120;
const OAK_MIN_PLANK_LENGTH_PX = 90;
const OAK_PLANK_LENGTH_SPREAD_PX = 110;
const OAK_SHADE_JITTER_AMOUNT = 0.1;
const OAK_SEAM_COLOR = 0xb99a72;
const OAK_SEAM_ALPHA = 0.35;

// Carpet tile floor constants
const CARPET_DEFAULT_COLOR = 0x7d8796;
const CARPET_TILE_SIZE_PX = TILE * 2;
const CARPET_SHADE_JITTER_AMOUNT = 0.06;
const CARPET_SEAM_COLOR = 0x000000;
const CARPET_SEAM_ALPHA = 0.05;

// Terrazzo floor constants
const TERRAZZO_BASE_COLOR = 0xebe6de;
const TERRAZZO_CHIP_COLORS = [0xb9b1a6, 0xd3a58b, 0x9fb3a9, 0x8f8a84, 0xffffff] as const;
const TERRAZZO_CHIP_AREA_DIVISOR = 260;
const TERRAZZO_CHIP_ALPHA = 0.55;
const TERRAZZO_MIN_CHIP_SIZE_PX = 1.5;
const TERRAZZO_CHIP_SIZE_SPREAD_PX = 2.5;
const TERRAZZO_MIN_ASPECT = 0.6;
const TERRAZZO_ASPECT_SPREAD = 0.6;

function drawOakFloor(g: G, x: number, y: number, w: number, h: number, random: Random) {
  // Staggered planks with slightly different tones, like real wood.
  g.fillStyle(OAK_BASE_COLOR, 1);
  g.fillRect(x, y, w, h);
  for (let py = y; py < y + h; py += OAK_PLANK_HEIGHT_PX) {
    let px = x - random() * OAK_OFFSET_JITTER_PX;
    while (px < x + w) {
      const len = OAK_MIN_PLANK_LENGTH_PX + random() * OAK_PLANK_LENGTH_SPREAD_PX;
      const left = Math.max(px, x);
      const right = Math.min(px + len, x + w);
      g.fillStyle(shade(OAK_BASE_COLOR, (random() - 0.5) * OAK_SHADE_JITTER_AMOUNT), 1);
      g.fillRect(left, py, right - left, OAK_PLANK_HEIGHT_PX - 1);
      px += len;
    }
    g.fillStyle(OAK_SEAM_COLOR, OAK_SEAM_ALPHA);
    g.fillRect(x, py + OAK_PLANK_HEIGHT_PX - 1, w, 1);
  }
}

function drawCarpetFloor(g: G, x: number, y: number, w: number, h: number, color: number | undefined, random: Random) {
  // Carpet tiles, slightly rotated tones, subtle seams.
  const base = color ?? CARPET_DEFAULT_COLOR;
  g.fillStyle(base, 1);
  g.fillRect(x, y, w, h);
  for (let ty = y; ty < y + h; ty += CARPET_TILE_SIZE_PX) {
    for (let tx = x; tx < x + w; tx += CARPET_TILE_SIZE_PX) {
      g.fillStyle(shade(base, (random() - 0.5) * CARPET_SHADE_JITTER_AMOUNT), 1);
      g.fillRect(tx, ty, Math.min(CARPET_TILE_SIZE_PX, x + w - tx), Math.min(CARPET_TILE_SIZE_PX, y + h - ty));
    }
  }
  g.fillStyle(CARPET_SEAM_COLOR, CARPET_SEAM_ALPHA);
  for (let ty = y; ty < y + h; ty += CARPET_TILE_SIZE_PX) g.fillRect(x, ty, w, 1);
  for (let tx = x; tx < x + w; tx += CARPET_TILE_SIZE_PX) g.fillRect(tx, y, 1, h);
}

function drawTerrazzoFloor(g: G, x: number, y: number, w: number, h: number, random: Random) {
  g.fillStyle(TERRAZZO_BASE_COLOR, 1);
  g.fillRect(x, y, w, h);
  const count = Math.round((w * h) / TERRAZZO_CHIP_AREA_DIVISOR);
  for (let i = 0; i < count; i++) {
    g.fillStyle(TERRAZZO_CHIP_COLORS[i % TERRAZZO_CHIP_COLORS.length], TERRAZZO_CHIP_ALPHA);
    const s = TERRAZZO_MIN_CHIP_SIZE_PX + random() * TERRAZZO_CHIP_SIZE_SPREAD_PX;
    g.fillRect(x + random() * (w - s), y + random() * (h - s), s, s * (TERRAZZO_MIN_ASPECT + random() * TERRAZZO_ASPECT_SPREAD));
  }
}

/** Draws the procedural floor pattern for a room onto a graphics target. */
export function drawFloor(g: G, room: Room) {
  const x = room.x * TILE;
  const y = room.y * TILE;
  const w = room.w * TILE;
  const h = room.h * TILE;
  const random = seededRandom(room.id);

  switch (room.floor) {
    case 'oak':
      drawOakFloor(g, x, y, w, h, random);
      break;
    case 'carpet':
      drawCarpetFloor(g, x, y, w, h, room.color, random);
      break;
    case 'terrazzo':
      drawTerrazzoFloor(g, x, y, w, h, random);
      break;
  }
}

/**
 * 2.5D wall geometry calculations and procedural rendering (solid walls, glass partitions, caps).
 * Collider footprints match physical obstacles, while front faces and caps rise in local pixels.
 */
import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Wall } from '../layout/types';

type G = Phaser.GameObjects.Graphics;

// Wall paint, skirting, and shading colors
const WALL_PAINT = 0xeee9e2;
const SKIRTING = 0xd6cec3;
const SOLID_CAP_BASE = 0x2d3236;
const SOLID_CAP_HIGHLIGHT = 0x4a5258;

// Glass partition colors and alphas
const GLASS_TINT = 0xcfe7ef;
const GLASS_ALPHA = 0.3;
const GLASS_HIGHLIGHT_COLOR = 0xffffff;
const GLASS_HIGHLIGHT_ALPHA = 0.45;
const GLASS_FRAME_COLOR = 0x7d8a93;
const GLASS_CAP_FILL = 0xbcdde8;
const GLASS_CAP_ALPHA = 0.75;

// Shadow and stroke dimensions
const SHADOW_COLOR = 0x000000;
const CAP_SHADE_ALPHA = 0.08;
const CAP_SHADE_HEIGHT_PX = 5;
const SKIRTING_HEIGHT_PX = 5;
const FLOOR_SHADOW_ALPHA = 0.08;
const GLASS_HIGHLIGHT_OFFSET_PX = 4;
const GLASS_HIGHLIGHT_HEIGHT_PX = 1.5;
const GLASS_BASE_HEIGHT_PX = 3;
const GLASS_FRAME_STROKE_PX = 1.5;
const GLASS_POST_WIDTH_PX = 2;
const SOLID_CAP_HIGHLIGHT_HEIGHT_PX = 2;

// 2.5D walls. The collider is only the wall's footprint (its thickness). What
// you see is the wall standing up from its base line: a painted front face
// rising `height` px above the base, topped by a thin dark cap. Tall faces
// cover the floor behind them, so game/render/wallFaces.ts fades them near people.
const WALL = {
  solid: { thickness: 10, height: 80 },
  glass: { thickness: 6, height: 80 },
};

/** Extra pixels drawn under the base line (contact shadow). */
const WALL_SHADOW = 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Checks whether a wall runs horizontally (constant y). */
export function isHorizontal(wall: Wall) {
  return wall.y1 === wall.y2;
}

/** Visible height of the wall's face above its base line (0: low wall, only the cap). */
export function wallHeight(wall: Wall) {
  return wall.face === false ? 0 : WALL[wall.kind].height;
}

/** Y of the base line: where the wall meets the floor on its south side. */
export function wallBase(wall: Wall) {
  const t = WALL[wall.kind].thickness;
  return (isHorizontal(wall) ? wall.y1 : Math.max(wall.y1, wall.y2)) * TILE + t / 2;
}

/** Area the player cannot walk into: the wall's footprint. */
export function wallCollider(wall: Wall): Rect {
  const { thickness } = WALL[wall.kind];
  if (isHorizontal(wall)) {
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

/** Everything drawn for the wall (cap, face and contact shadow), in pixels. */
export function wallBounds(wall: Wall): Rect {
  const r = wallCollider(wall);
  const height = wallHeight(wall);
  const { thickness } = WALL[wall.kind];
  const base = wallBase(wall);
  const top = isHorizontal(wall) ? base - height - thickness : r.y - height;
  return { x: r.x, y: top, w: r.w, h: base + WALL_SHADOW - top };
}

/**
 * Draws one wall in world coordinates. Horizontal walls: front face, skirting
 * and a cap on top. Vertical walls: a long cap (the wall seen from above, lifted
 * by its height) ending in the south end face.
 */
export function drawWall(g: G, wall: Wall) {
  const { thickness } = WALL[wall.kind];
  const height = wallHeight(wall);
  const r = wallCollider(wall);
  const base = wallBase(wall);
  const solid = wall.kind === 'solid';

  if (isHorizontal(wall)) {
    if (height === 0) return drawCap(g, wall, r);
    const faceTop = base - height;
    const cap = { x: r.x, y: faceTop - thickness, w: r.w, h: thickness };
    if (solid) {
      g.fillStyle(WALL_PAINT, 1); // painted wall
      g.fillRect(r.x, faceTop, r.w, height);
      g.fillStyle(SHADOW_COLOR, CAP_SHADE_ALPHA); // shade under the cap
      g.fillRect(r.x, faceTop, r.w, CAP_SHADE_HEIGHT_PX);
      g.fillStyle(SKIRTING, 1); // skirting board
      g.fillRect(r.x, base - SKIRTING_HEIGHT_PX, r.w, SKIRTING_HEIGHT_PX);
      g.fillStyle(SHADOW_COLOR, FLOOR_SHADOW_ALPHA); // contact shadow on the floor
      g.fillRect(r.x, base, r.w, WALL_SHADOW);
    } else {
      g.fillStyle(GLASS_TINT, GLASS_ALPHA);
      g.fillRect(r.x, faceTop, r.w, height);
      g.fillStyle(GLASS_HIGHLIGHT_COLOR, GLASS_HIGHLIGHT_ALPHA);
      g.fillRect(r.x, faceTop + GLASS_HIGHLIGHT_OFFSET_PX, r.w, GLASS_HIGHLIGHT_HEIGHT_PX);
      g.fillStyle(GLASS_FRAME_COLOR, 1);
      g.fillRect(r.x, base - GLASS_BASE_HEIGHT_PX, r.w, GLASS_BASE_HEIGHT_PX);
      for (let px = r.x; px <= r.x + r.w + 0.5; px += TILE * 2) {
        g.fillRect(Math.min(px, r.x + r.w - GLASS_POST_WIDTH_PX), faceTop, GLASS_POST_WIDTH_PX, height);
      }
    }
    drawCap(g, wall, cap);
    return;
  }

  // Vertical: the cap is the footprint lifted by the wall's height; below its south end the end face.
  const cap = { x: r.x, y: r.y - height, w: r.w, h: r.h };
  if (height > 0) {
    g.fillStyle(solid ? WALL_PAINT : GLASS_TINT, solid ? 1 : GLASS_ALPHA);
    g.fillRect(r.x, cap.y + cap.h, r.w, height);
    if (solid) {
      g.fillStyle(SKIRTING, 1);
      g.fillRect(r.x, base - SKIRTING_HEIGHT_PX, r.w, SKIRTING_HEIGHT_PX);
    }
    g.fillStyle(SHADOW_COLOR, FLOOR_SHADOW_ALPHA);
    g.fillRect(r.x, base, r.w, WALL_SHADOW);
  }
  drawCap(g, wall, cap);
}

function drawCap(g: G, wall: Wall, cap: Rect) {
  if (wall.kind === 'solid') {
    g.fillStyle(SOLID_CAP_BASE, 1);
    g.fillRect(cap.x, cap.y, cap.w, cap.h);
    g.fillStyle(SOLID_CAP_HIGHLIGHT, 1);
    g.fillRect(cap.x, cap.y, cap.w, SOLID_CAP_HIGHLIGHT_HEIGHT_PX);
    return;
  }
  g.fillStyle(GLASS_CAP_FILL, GLASS_CAP_ALPHA);
  g.fillRect(cap.x, cap.y, cap.w, cap.h);
  g.fillStyle(GLASS_FRAME_COLOR, 1);
  if (isHorizontal(wall)) {
    g.fillRect(cap.x, cap.y, cap.w, GLASS_FRAME_STROKE_PX);
    g.fillRect(cap.x, cap.y + cap.h - GLASS_FRAME_STROKE_PX, cap.w, GLASS_FRAME_STROKE_PX);
  } else {
    g.fillRect(cap.x, cap.y, GLASS_FRAME_STROKE_PX, cap.h);
    g.fillRect(cap.x + cap.w - GLASS_FRAME_STROKE_PX, cap.y, GLASS_FRAME_STROKE_PX, cap.h);
  }
}

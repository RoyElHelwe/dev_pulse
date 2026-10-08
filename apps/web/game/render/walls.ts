import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Wall } from '../layout/types';

type G = Phaser.GameObjects.Graphics;

// 2.5D walls. The collider is only the wall's footprint (its thickness). What
// you see is the wall standing up from its base line: a painted front face
// rising `height` px above the base, topped by a thin dark cap. Tall faces
// cover the floor behind them, so game/render/wallFaces.ts fades them near people.
export const WALL = {
  solid: { thickness: 10, height: 80 },
  glass: { thickness: 6, height: 80 },
};

/** Extra pixels drawn under the base line (contact shadow). */
export const WALL_SHADOW = 6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
      g.fillStyle(0xeee9e2, 1); // painted wall
      g.fillRect(r.x, faceTop, r.w, height);
      g.fillStyle(0x000000, 0.08); // shade under the cap
      g.fillRect(r.x, faceTop, r.w, 5);
      g.fillStyle(0xd6cec3, 1); // skirting board
      g.fillRect(r.x, base - 5, r.w, 5);
      g.fillStyle(0x000000, 0.08); // contact shadow on the floor
      g.fillRect(r.x, base, r.w, WALL_SHADOW);
    } else {
      g.fillStyle(0xcfe7ef, 0.3);
      g.fillRect(r.x, faceTop, r.w, height);
      g.fillStyle(0xffffff, 0.45);
      g.fillRect(r.x, faceTop + 4, r.w, 1.5);
      g.fillStyle(0x7d8a93, 1);
      g.fillRect(r.x, base - 3, r.w, 3);
      for (let px = r.x; px <= r.x + r.w + 0.5; px += TILE * 2) {
        g.fillRect(Math.min(px, r.x + r.w - 2), faceTop, 2, height);
      }
    }
    drawCap(g, wall, cap);
    return;
  }

  // Vertical: the cap is the footprint lifted by the wall's height; below its south end the end face.
  const cap = { x: r.x, y: r.y - height, w: r.w, h: r.h };
  if (height > 0) {
    g.fillStyle(solid ? 0xeee9e2 : 0xcfe7ef, solid ? 1 : 0.3);
    g.fillRect(r.x, cap.y + cap.h, r.w, height);
    if (solid) {
      g.fillStyle(0xd6cec3, 1);
      g.fillRect(r.x, base - 5, r.w, 5);
    }
    g.fillStyle(0x000000, 0.08);
    g.fillRect(r.x, base, r.w, WALL_SHADOW);
  }
  drawCap(g, wall, cap);
}

function drawCap(g: G, wall: Wall, cap: Rect) {
  if (wall.kind === 'solid') {
    g.fillStyle(0x2d3236, 1);
    g.fillRect(cap.x, cap.y, cap.w, cap.h);
    g.fillStyle(0x4a5258, 1);
    g.fillRect(cap.x, cap.y, cap.w, 2);
    return;
  }
  g.fillStyle(0xbcdde8, 0.75);
  g.fillRect(cap.x, cap.y, cap.w, cap.h);
  g.fillStyle(0x7d8a93, 1);
  if (isHorizontal(wall)) {
    g.fillRect(cap.x, cap.y, cap.w, 1.5);
    g.fillRect(cap.x, cap.y + cap.h - 1.5, cap.w, 1.5);
  } else {
    g.fillRect(cap.x, cap.y, 1.5, cap.h);
    g.fillRect(cap.x + cap.w - 1.5, cap.y, 1.5, cap.h);
  }
}

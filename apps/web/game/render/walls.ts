import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Wall } from '../layout/types';

type G = Phaser.GameObjects.Graphics;

export const WALL = {
  solid: { thickness: 10, face: 34 },
  glass: { thickness: 6, face: 18 },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function isHorizontal(wall: Wall) {
  return wall.y1 === wall.y2;
}

/** Area the player cannot walk into (the wall plus its visible face). */
export function wallCollider(wall: Wall): Rect {
  const { thickness, face } = WALL[wall.kind];
  if (isHorizontal(wall)) {
    const faceH = wall.face === false ? 0 : face;
    return {
      x: Math.min(wall.x1, wall.x2) * TILE,
      y: wall.y1 * TILE - thickness / 2,
      w: Math.abs(wall.x2 - wall.x1) * TILE,
      h: thickness + faceH,
    };
  }
  return {
    x: wall.x1 * TILE - thickness / 2,
    y: Math.min(wall.y1, wall.y2) * TILE - thickness / 2,
    w: thickness,
    h: Math.abs(wall.y2 - wall.y1) * TILE + thickness,
  };
}

/**
 * Draws one wall. Horizontal walls are seen in 3/4 view: a dark top edge plus
 * the painted front face below it, so the office feels like it has height.
 */
export function drawWall(g: G, wall: Wall) {
  const { thickness, face } = WALL[wall.kind];
  const r = wallCollider(wall);

  if (wall.kind === 'solid') {
    if (isHorizontal(wall) && wall.face !== false) {
      const top = r.y + thickness;
      g.fillStyle(0xeee9e2, 1); // painted wall
      g.fillRect(r.x, top, r.w, face);
      g.fillStyle(0x000000, 0.06); // shade under the ceiling
      g.fillRect(r.x, top, r.w, 4);
      g.fillStyle(0xd6cec3, 1); // skirting board
      g.fillRect(r.x, top + face - 4, r.w, 4);
      g.fillStyle(0x000000, 0.08); // contact shadow on the floor
      g.fillRect(r.x, top + face, r.w, 5);
    }
    const cap = isHorizontal(wall) ? { ...r, h: thickness } : r;
    g.fillStyle(0x2d3236, 1);
    g.fillRect(cap.x, cap.y, cap.w, cap.h);
    g.fillStyle(0x4a5258, 1);
    g.fillRect(cap.x, cap.y, cap.w, 2);
    return;
  }

  // Glass: translucent panes with thin aluminium frames.
  if (isHorizontal(wall)) {
    const top = r.y + thickness;
    g.fillStyle(0xcfe7ef, 0.35);
    g.fillRect(r.x, top, r.w, face);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(r.x, top + 3, r.w, 1.5);
    g.fillStyle(0x7d8a93, 1);
    g.fillRect(r.x, top + face - 2, r.w, 2);
    for (let px = r.x; px <= r.x + r.w + 0.5; px += TILE * 2) {
      g.fillRect(Math.min(px, r.x + r.w - 2), r.y, 2, thickness + face);
    }
  }
  const cap = isHorizontal(wall) ? { ...r, h: thickness } : r;
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

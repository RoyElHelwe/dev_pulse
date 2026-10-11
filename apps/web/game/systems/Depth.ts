/**
 * Render depth bands and sorting calculations for office entities.
 * Determines draw order for floor, furniture, characters, and UI overlays.
 */

import {
  DEPTH_SORT_DIVISOR,
  SEATED_DEPTH_OFFSET,
  SEATED_DEPTH_RADIUS_PX,
  TILE,
  WALL_MOUNTED_DEPTH_OFFSET,
} from '../constants';
import { itemBounds } from '../layout/derive';
import { faceBase, isWallMounted, mountWall } from '../layout/mount';
import type { Furniture, Wall } from '../layout/types';
import { FURNITURE } from '../render/furniture';

/**
 * Global draw layers (depth bands).
 * Draw order: floor and walls (baked) < rugs < shadows < y-sorted (furniture + people + plates) < badges < hints.
 */
export const DEPTH = {
  /** Floor tiles and static baked scenery textures. */
  floor: 0,
  /** Rugs and carpets placed directly on the floor. */
  rug: 1,
  /** Drop shadows cast beneath furniture. */
  shadow: 2,
  /** Dynamic Y-sorted entities (furniture, players, desk plates). */
  sorted: 10,
  /** Room booking badges and counters floating above rooms. */
  badges: 20,
  /** Floating interaction prompts and hints. */
  hints: 900,
} as const;

interface SeatDepthTarget {
  centerX: number;
  centerY: number;
  item: Furniture;
}

/** Computes render depth for a furniture item, sorting rugs to the floor and wall-mounted art to its face base. */
export function furnitureDepth(item: Furniture, walls: readonly Wall[] = []): number {
  if (isWallMounted(item.kind)) {
    const wall = mountWall(item, walls as Wall[]);
    const base = wall ? faceBase(wall) : null;
    const basePx = (base ?? (item.y - item.h / 2)) * TILE;
    return DEPTH.sorted + basePx / DEPTH_SORT_DIVISOR + WALL_MOUNTED_DEPTH_OFFSET;
  }
  const spec = FURNITURE[item.kind];
  const b = itemBounds(item);
  const bottomPx = (b.y + b.h) * TILE;
  return spec.layer === 'floor' ? DEPTH.rug : DEPTH.sorted + bottomPx / DEPTH_SORT_DIVISOR;
}

/** Computes render depth for an avatar, sorting behind seats when sitting or by feet Y position when standing. */
export function peopleDepth(
  x: number,
  y: number,
  seated = false,
  seats: readonly SeatDepthTarget[] = [],
  walls: readonly Wall[] = [],
): number {
  if (seated) {
    for (const s of seats) {
      if (Math.hypot(x - s.centerX, y - s.centerY) <= SEATED_DEPTH_RADIUS_PX) {
        return furnitureDepth(s.item, walls) + SEATED_DEPTH_OFFSET;
      }
    }
  }
  return DEPTH.sorted + y / DEPTH_SORT_DIVISOR;
}

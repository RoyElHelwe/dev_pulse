/**
 * Room lock and spatial navigation system for meeting rooms and spawn boundaries.
 * Manages solid colliders over locked meeting rooms, obstacle tracking, and arrival point selection.
 */

import * as Phaser from 'phaser';
import {
  PLAYER_BODY_HEIGHT_PX,
  PLAYER_BODY_OFFSET_X_PX,
  PLAYER_BODY_OFFSET_Y_PX,
  PLAYER_BODY_WIDTH_PX,
  TILE,
} from '../constants';
import type { Rect } from '../layout/geometry';
import type { OfficeLayout } from '../layout/types';

/** Number of random spawn attempts when finding an arrival spot near the entrance. */
const SPAWN_ATTEMPTS = 20;

/** Margin in pixels from the bottom map edge when choosing a spawn spot. */
const SPAWN_BOTTOM_MARGIN_PX = 4;

/** Minimum arrival distance offset from spawn in tiles to keep arriving players spread out. */
const ARRIVAL_MIN_DISTANCE_TILES = 0.5;

/** Additional random distance jitter in tiles added to the arrival radius (< 3 tiles total). */
const ARRIVAL_JITTER_DISTANCE_TILES = 0.9;

/** Vertical perspective squish factor for spawn jitter (makes the arrival area an ellipse). */
const SPAWN_Y_SQUISH = 0.6;

/** Map boundary padding in tiles to prevent spawning or standing half-outside the office grid. */
const MAP_BOUNDARY_PADDING_TILES = 0.5;

/** Map top boundary padding in tiles to prevent standing behind north perimeter walls. */
const MAP_TOP_PADDING_TILES = 1;

/** Number of half-turns in a full circle revolution. */
const HALF_TURNS_PER_CIRCLE = 2;

/** Full circle angle in radians for circular random spawn distribution. */
const FULL_CIRCLE_RAD = Math.PI * HALF_TURNS_PER_CIRCLE;

/** Divisor to find rectangle center point for Phaser zone placement. */
const RECT_CENTER_DIVISOR = 2;

/** Converts a bounding box in grid tiles to world pixel coordinates. */
export function pixels(r: Rect): Rect {
  return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
}

/** Checks whether two axis-aligned rectangles overlap. */
function overlapsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Returns the local player physics body rectangle (18 × 10 px) for feet anchored at (x, y). */
function playerBody(x: number, y: number): Rect {
  return {
    x: x + PLAYER_BODY_OFFSET_X_PX,
    y: y + PLAYER_BODY_OFFSET_Y_PX,
    w: PLAYER_BODY_WIDTH_PX,
    h: PLAYER_BODY_HEIGHT_PX,
  };
}

/** Dependencies and callbacks required by the RoomLocks system. */
export interface RoomLocksOptions {
  scene: Phaser.Scene;
  getLayout: () => OfficeLayout;
  getPlayerPos: () => { x: number; y: number };
}

/** Manages physics colliders for booked meeting rooms, obstacles, and free space checks. */
export class RoomLocks {
  private readonly scene: Phaser.Scene;
  private readonly getLayout: () => OfficeLayout;
  private readonly getPlayerPos: () => { x: number; y: number };

  /** Active locked room colliders and their bounding boxes. */
  locked: Array<{ roomId: string; rect: Rect }> = [];

  /** Physics static group holding collider zones for locked rooms. */
  readonly lockedSolids: Phaser.Physics.Arcade.StaticGroup;

  /** Registered solid obstacles (walls, solid furniture) blocking movement. */
  readonly obstacles: Rect[] = [];

  constructor(opts: RoomLocksOptions) {
    this.scene = opts.scene;
    this.getLayout = opts.getLayout;
    this.getPlayerPos = opts.getPlayerPos;
    this.lockedSolids = opts.scene.physics.add.staticGroup();
  }

  /** Adds a solid obstacle collider zone to physics and tracks it in the obstacle list. */
  addSolidCollider(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number, h: number): void {
    this.obstacles.push({ x, y, w, h });
    group.add(this.scene.add.zone(x + w / RECT_CENTER_DIVISOR, y + h / RECT_CENTER_DIVISOR, w, h));
  }

  /** Registers a rectangular solid obstacle blocking player locomotion. */
  addObstacle(rect: Rect): void {
    this.obstacles.push(rect);
  }

  /** True if the player's body fits at these feet coordinates (inside the office boundary and not colliding). */
  isFree(x: number, y: number): boolean {
    const { width, height } = this.getLayout();
    if (
      x < TILE * MAP_BOUNDARY_PADDING_TILES ||
      y < TILE * MAP_TOP_PADDING_TILES ||
      x > (width - MAP_BOUNDARY_PADDING_TILES) * TILE ||
      y > (height - MAP_BOUNDARY_PADDING_TILES) * TILE
    ) {
      return false;
    }
    const body = playerBody(x, y);
    return !this.obstacles.some((o) => overlapsRect(body, o)) && !this.blocks(body);
  }

  /** Computes a free arrival spot around the office entrance so arriving players spread out. */
  arrivalPoint(): { x: number; y: number } {
    const layout = this.getLayout();
    const spawn = { x: layout.spawn.x * TILE, y: layout.spawn.y * TILE };
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * FULL_CIRCLE_RAD;
      const distance = TILE * (ARRIVAL_MIN_DISTANCE_TILES + Math.random() * ARRIVAL_JITTER_DISTANCE_TILES);
      const x = spawn.x + Math.cos(angle) * distance;
      const y = spawn.y + Math.sin(angle) * distance * SPAWN_Y_SQUISH;
      if (this.isFree(x, y) && y < layout.height * TILE - SPAWN_BOTTOM_MARGIN_PX) {
        return { x, y };
      }
    }
    return spawn;
  }

  /**
   * Updates solid colliders for locked rooms from booked meeting room IDs.
   * Returns the ID of the room the player body currently overlaps (if any), or null.
   */
  set(roomIds: string[]): string | null {
    const ids = new Set(roomIds);
    const layout = this.getLayout();
    this.locked = layout.rooms
      .filter((r) => r.kind === 'meeting' && ids.has(r.id))
      .map((r) => ({ roomId: r.id, rect: pixels(r) }));

    this.lockedSolids.clear(true, true);
    for (const { rect } of this.locked) {
      this.lockedSolids.add(this.scene.add.zone(rect.x + rect.w / RECT_CENTER_DIVISOR, rect.y + rect.h / RECT_CENTER_DIVISOR, rect.w, rect.h));
    }

    const pos = this.getPlayerPos();
    const body = playerBody(pos.x, pos.y);
    const inside = this.locked.find(({ rect }) => overlapsRect(body, rect));
    return inside ? inside.roomId : null;
  }

  /** Returns true if the given rectangle overlaps any locked room collider. */
  blocks(rect: Rect): boolean {
    return this.locked.some(({ rect: r }) => overlapsRect(rect, r));
  }
}

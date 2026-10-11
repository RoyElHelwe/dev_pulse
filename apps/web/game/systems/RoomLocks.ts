/**
 * Room lock management system for booked meeting rooms.
 * Creates solid colliders over locked meeting rooms and detects player presence inside them.
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

/** Converts a bounding box in grid tiles to world pixel coordinates. */
export function pixels(r: Rect): Rect {
  return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
}

/** Checks whether two axis-aligned rectangles overlap. */
export function overlapsRect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Returns the local player physics body rectangle (18 × 10 px) for feet anchored at (x, y). */
export function playerBody(x: number, y: number): Rect {
  return {
    x: x + PLAYER_BODY_OFFSET_X_PX,
    y: y + PLAYER_BODY_OFFSET_Y_PX,
    w: PLAYER_BODY_WIDTH_PX,
    h: PLAYER_BODY_HEIGHT_PX,
  };
}

interface RoomLocksOptions {
  scene: Phaser.Scene;
  getLayout: () => OfficeLayout;
  getPlayerPos: () => { x: number; y: number };
}

/** Manages physics colliders for booked meeting rooms that the player is locked out of. */
export class RoomLocks {
  private readonly scene: Phaser.Scene;
  private readonly getLayout: () => OfficeLayout;
  private readonly getPlayerPos: () => { x: number; y: number };

  locked: Array<{ roomId: string; rect: Rect }> = [];
  readonly lockedSolids: Phaser.Physics.Arcade.StaticGroup;

  constructor(opts: RoomLocksOptions) {
    this.scene = opts.scene;
    this.getLayout = opts.getLayout;
    this.getPlayerPos = opts.getPlayerPos;
    this.lockedSolids = opts.scene.physics.add.staticGroup();
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
      this.lockedSolids.add(this.scene.add.zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h));
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

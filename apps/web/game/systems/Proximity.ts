/**
 * Proximity voice and spatial audio trigger system.
 * Evaluates distances (in tiles) between the local avatar and remote peers within the same room.
 */

import { officeEvents } from '@/features/office/events';

/** Closer than this (in tiles) = near: voice starts (Zakaria, Z3). */
export const NEAR_RADIUS = 3;
/** Further than this = far again. The gap stops flickering at the edge (hysteresis). */
const FAR_RADIUS = NEAR_RADIUS + 0.5;
/** `player:distance` at most 5 times a second per person. */
const DISTANCE_EVERY_MS = 200;
/** Rounding precision factor (2 decimal places) for distance comparisons. */
const DISTANCE_ROUND_FACTOR = 100;
/** Minimum delta in tile distance required to emit an updated distance event. */
const MIN_DISTANCE_DELTA = 0.05;

interface Point {
  x: number;
  y: number;
}

/**
 * Turns positions into player:near / player:distance / player:far events.
 * Only people in the same room count: a wall (even glass) separates them.
 * Positions in tiles.
 */
export class Proximity {
  /** userId → last distance sent and when. */
  private near = new Map<string, { at: number; distance: number }>();
  private readonly seen = new Set<string>();

  constructor(private readonly roomAt: (x: number, y: number) => string | null) {}

  /** Evaluates distances to peers and emits near, far, or distance change events. */
  update(now: number, me: Point, others: Iterable<[string, Point]>) {
    const myRoom = this.roomAt(me.x, me.y);
    this.seen.clear();
    for (const [userId, p] of others) {
      this.seen.add(userId);
      const distance = Math.round(Math.hypot(p.x - me.x, p.y - me.y) * DISTANCE_ROUND_FACTOR) / DISTANCE_ROUND_FACTOR;
      const sameRoom = this.roomAt(p.x, p.y) === myRoom;
      const state = this.near.get(userId);
      if (!state) {
        if (sameRoom && distance < NEAR_RADIUS) {
          this.near.set(userId, { at: now, distance });
          officeEvents.emit('player:near', { userId, distance });
        }
      } else if (!sameRoom || distance > FAR_RADIUS) {
        this.near.delete(userId);
        officeEvents.emit('player:far', { userId });
      } else if (now - state.at >= DISTANCE_EVERY_MS && Math.abs(distance - state.distance) >= MIN_DISTANCE_DELTA) {
        this.near.set(userId, { at: now, distance });
        officeEvents.emit('player:distance', { userId, distance });
      }
    }
    // Gone (left the office): far.
    for (const userId of this.near.keys()) {
      if (!this.seen.has(userId)) {
        this.near.delete(userId);
        officeEvents.emit('player:far', { userId });
      }
    }
  }

  /** Everyone is far (the office reloads or closes). */
  clear() {
    for (const userId of this.near.keys()) officeEvents.emit('player:far', { userId });
    this.near.clear();
    this.seen.clear();
  }

  /** Returns whether the given user is currently within proximity range. */
  isNear(userId: string) {
    return this.near.has(userId);
  }
}

import { officeEvents } from '@/features/office/events';

/** Closer than this (in tiles) = near: voice starts (Zakaria, Z3). */
export const NEAR_RADIUS = 3;
/** Further than this = far again. The gap stops flickering at the edge. */
const FAR_RADIUS = NEAR_RADIUS + 0.5;
/** `player:distance` at most 5 times a second per person. */
const DISTANCE_EVERY_MS = 200;

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

  constructor(private readonly roomAt: (x: number, y: number) => string | null) {}

  update(now: number, me: Point, others: Iterable<[string, Point]>) {
    const myRoom = this.roomAt(me.x, me.y);
    const seen = new Set<string>();
    for (const [userId, p] of others) {
      seen.add(userId);
      const distance = Math.round(Math.hypot(p.x - me.x, p.y - me.y) * 100) / 100;
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
      } else if (now - state.at >= DISTANCE_EVERY_MS && Math.abs(distance - state.distance) >= 0.05) {
        this.near.set(userId, { at: now, distance });
        officeEvents.emit('player:distance', { userId, distance });
      }
    }
    // Gone (left the office): far.
    for (const userId of this.near.keys()) {
      if (!seen.has(userId)) {
        this.near.delete(userId);
        officeEvents.emit('player:far', { userId });
      }
    }
  }

  /** Everyone is far (the office reloads or closes). */
  clear() {
    for (const userId of this.near.keys()) officeEvents.emit('player:far', { userId });
    this.near.clear();
  }

  isNear(userId: string) {
    return this.near.has(userId);
  }
}

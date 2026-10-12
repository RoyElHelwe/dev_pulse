// Small office rules (no Nest), shared by the live features and easy to test.

import { TILE } from './layout/geometry';

/** Room and zone ids of the layout, also used as chat channels. */
export const ZONE_ID = /^[\w:-]{1,64}$/;

/** Flood protection for one socket: at most `perSecond` messages in each second. */
export class Budget {
  private second = 0;
  private count = 0;

  constructor(private readonly perSecond: number) {}

  allow(now = Date.now()) {
    const second = Math.floor(now / 1000);
    if (second !== this.second) [this.second, this.count] = [second, 0];
    return ++this.count <= this.perSecond;
  }
}

/** Walking speed in pixels per second (WALK_SPEED in apps/web/game/constants.ts). */
export const WALK_SPEED = 170;
/** Someone idle longer than this still only gets this much walking time. */
const MAX_ELAPSED_MS = 2000;
/** The game's arrival point is a free spot within ~1.5 tiles of the spawn. */
const ARRIVAL_PX = 3 * TILE;

type Point = { x: number; y: number };

/**
 * Where the server takes a player who reports `to` (pixels) `elapsedMs` after
 * being at `from`: there if they could have walked it (generous slack for uneven
 * packets), otherwise as far towards it as walking allows, so a lagging player
 * catches up within a moment and a jump becomes a run. Jumps to the entrance
 * (`spawn`) are fine: the game puts people there when they arrive, after a
 * layout reload or when a booking sends them out of a room. Walls aren't
 * checked: a modified client could walk through one, but not jump into a room.
 */
export function limitMove(from: Point, to: Point, elapsedMs: number, spawn: Point): Point {
  if (Math.hypot(to.x - spawn.x, to.y - spawn.y) <= ARRIVAL_PX) return to;
  const seconds = Math.min(Math.max(elapsedMs, 0), MAX_ELAPSED_MS) / 1000;
  const max = 1.6 * WALK_SPEED * seconds + TILE;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance <= max) return to;
  const k = max / distance;
  return { x: Math.round(from.x + (to.x - from.x) * k), y: Math.round(from.y + (to.y - from.y) * k) };
}

/** A live connection of someone already in the office: its id and the browser tab it belongs to. */
export interface OpenTab {
  id: string;
  tabId: string;
}

/**
 * One office tab at a time. A new connection of a user who already has the office open:
 * - same tab (it reconnected after a network loss): quietly takes over, nobody is told;
 * - another tab, asked to take over ("Use here"): the old tabs are told and dropped;
 * - another tab, not asked: refused (it shows "open in another tab").
 */
export function claimOffice(open: OpenTab[], tabId: string, takeover: boolean): { refuse: boolean; drop: OpenTab[]; notify: OpenTab[] } {
  const others = open.filter((t) => t.tabId !== tabId);
  if (others.length > 0 && !takeover) return { refuse: true, drop: [], notify: [] };
  return { refuse: false, drop: open, notify: others };
}

/** The tab id a client sends in the handshake (random, per page load). */
export const TAB_ID = /^[\w-]{8,64}$/;

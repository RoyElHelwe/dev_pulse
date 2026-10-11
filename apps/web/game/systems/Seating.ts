/**
 * Seating management system for chairs, armchairs, and stools in the office.
 * Handles sit and stand transitions, candidate dwell timing, and seat occupancy checks.
 */

import * as Phaser from 'phaser';
import {
  ARMCHAIR_MARGIN_PX,
  SEAT_TAKEN_RADIUS_PX,
  SEAT_Y_OFFSET_PX,
  SEAT_ZONE_TILES,
  SIT_DWELL_MS,
  STAND_HOLD_MS,
  STEP_OFF_DISTANCE_PX,
  TILE,
} from '../constants';
import { itemBounds } from '../layout/derive';
import type { Furniture, OfficeLayout } from '../layout/types';
import type { Avatar, Direction } from '../objects/Avatar';
import { pixels } from './RoomLocks';

/** Representation of an interactive seat placed in the office layout. */
export interface Seat {
  id: string;
  item: Furniture;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  dir: Direction | null;
}

/** Active seat occupied by a player, requiring a defined facing direction. */
export interface ActiveSeat extends Seat {
  dir: Direction;
}

/** Dependencies and callbacks required by the Seating system. */
export interface SeatingOptions {
  player: Avatar;
  layout: OfficeLayout;
  isFree: (x: number, y: number) => boolean;
  sendPosition: (moving?: boolean) => void;
  getOtherSeatedPositions: () => Array<{ x: number; y: number }>;
}

/** Step-off offsets in pixels when standing up toward each cardinal direction. */
export const STEP_OFF_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -STEP_OFF_DISTANCE_PX },
  down: { dx: 0, dy: STEP_OFF_DISTANCE_PX },
  left: { dx: -STEP_OFF_DISTANCE_PX, dy: 0 },
  right: { dx: STEP_OFF_DISTANCE_PX, dy: 0 },
};

/** Determines avatar facing direction from chair rotation in degrees. */
export function chairFacing(deg = 0): Direction {
  const r = ((deg % 360) + 360) % 360;
  if (r === 90) return 'right';
  if (r === 180) return 'down';
  if (r === 270) return 'left';
  return 'up';
}

/** Checks if world pixel coordinates fall within the sitting trigger zone for a seat. */
export function inSeatZone(seat: Seat, px: number, py: number): boolean {
  if (seat.item.kind === 'armchair') {
    const b = pixels(itemBounds(seat.item));
    return (
      px >= b.x - ARMCHAIR_MARGIN_PX &&
      px <= b.x + b.w + ARMCHAIR_MARGIN_PX &&
      py >= b.y - ARMCHAIR_MARGIN_PX &&
      py <= b.y + b.h + ARMCHAIR_MARGIN_PX
    );
  }
  return Math.hypot(px - seat.centerX, py - seat.centerY) <= TILE * SEAT_ZONE_TILES;
}

/** Determines primary cardinal direction from horizontal and vertical input axes. */
export function inputDirection(ix: number, iy: number): Direction | null {
  if (ix === 0 && iy === 0) return null;
  if (Math.abs(ix) > Math.abs(iy)) {
    return ix > 0 ? 'right' : 'left';
  }
  return iy > 0 ? 'down' : 'up';
}

/** Manages seat detection, sit/stand transitions, and dwell timing for the local player. */
export class Seating {
  /** All available seat items in the office layout. */
  readonly seats: Seat[];

  private readonly player: Avatar;
  private readonly isFree: (x: number, y: number) => boolean;
  private readonly sendPosition: (moving?: boolean) => void;
  private readonly getOtherSeatedPositions: () => Array<{ x: number; y: number }>;

  private seat: ActiveSeat | null = null;
  private seatCandidate: Seat | null = null;
  private dwellMs = 0;
  private standHoldMs = 0;
  private justLeft: string | null = null;

  constructor(opts: SeatingOptions) {
    this.player = opts.player;
    this.isFree = opts.isFree;
    this.sendPosition = opts.sendPosition;
    this.getOtherSeatedPositions = opts.getOtherSeatedPositions;

    this.seats = opts.layout.furniture
      .filter((f) => f.kind === 'chair' || f.kind === 'armchair' || f.kind === 'stool')
      .map((item) => ({
        id: item.id,
        item,
        x: item.x * TILE,
        y: item.y * TILE + SEAT_Y_OFFSET_PX,
        centerX: item.x * TILE,
        centerY: item.y * TILE,
        dir: item.kind === 'stool' ? null : chairFacing(item.rotation ?? 0),
      }));
  }

  /** Whether the local player is currently seated. */
  get isSeated(): boolean {
    return this.seat !== null;
  }

  /** Currently occupied seat, or null if standing. */
  get currentSeat(): ActiveSeat | null {
    return this.seat;
  }

  /** Clears the just-left seat guard once the player walks outside its interaction zone. */
  clearJustLeft(): void {
    // WHY: Prevents immediately re-sitting on the chair just vacated until the player steps outside its zone.
    if (this.justLeft) {
      const leftSeat = this.seats.find((s) => s.id === this.justLeft);
      if (!leftSeat || !inSeatZone(leftSeat, this.player.x, this.player.y)) {
        this.justLeft = null;
      }
    }
  }

  /** Checks if a seat is unoccupied by other players and not just vacated by the local player. */
  isSeatFree(seat: Seat): boolean {
    if (seat.id === this.justLeft) return false;
    for (const pos of this.getOtherSeatedPositions()) {
      if (Math.hypot(pos.x - seat.x, pos.y - seat.y) <= SEAT_TAKEN_RADIUS_PX) {
        return false;
      }
    }
    return true;
  }

  /** Seats the local player in the given chair, locking collision and updating animation. */
  sit(seat: Seat): void {
    const dir = seat.dir ?? this.player.facing;
    this.seat = { ...seat, dir };
    this.standHoldMs = 0;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.checkCollision.none = true;
    body.setVelocity(0, 0);
    body.reset(seat.x, seat.y);
    this.player.setSeated(true);
    this.player.animateAs(dir, false, 0);
    this.sendPosition(false);
  }

  /** Stands the local player up from their current seat, stepping off in the chosen direction. */
  standUp(forced = false, ix = 0, iy = 0): void {
    if (!this.seat) return;
    const seat = this.seat;
    const seatId = seat.id;
    const front = seat.dir;
    const primaryDir = forced ? null : inputDirection(ix, iy);

    // WHY: Step-off priority: intentional input direction > chair facing direction > fallback directions.
    const allDirs: Direction[] = ['up', 'down', 'left', 'right'];
    const tryDirs: Direction[] = [];
    if (primaryDir) {
      tryDirs.push(primaryDir);
    }
    if (front && !tryDirs.includes(front)) {
      tryDirs.push(front);
    }
    for (const d of allDirs) {
      if (!tryDirs.includes(d)) {
        tryDirs.push(d);
      }
    }

    let targetX = seat.x;
    let targetY = seat.y;
    for (const d of tryDirs) {
      const { dx, dy } = STEP_OFF_OFFSETS[d];
      const cx = seat.x + dx;
      const cy = seat.y + dy;
      if (this.isFree(cx, cy)) {
        targetX = cx;
        targetY = cy;
        break;
      }
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.checkCollision.none = false;
    body.reset(targetX, targetY);
    this.player.setSeated(false);
    this.seat = null;
    this.justLeft = seatId;
    this.standHoldMs = 0;
    this.sendPosition(false);
  }

  /** Updates seating dwell timer or stand hold timer depending on player seated state. */
  update(delta: number, inputX: number, inputY: number, canSit: boolean): void {
    this.clearJustLeft();

    if (this.seat) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
      body.reset(this.seat.x, this.seat.y);
      this.player.animateAs(this.seat.dir, false, delta);

      const hasInput = (inputX !== 0 || inputY !== 0) && canSit;
      if (hasInput) {
        this.standHoldMs += delta;
        if (this.standHoldMs >= STAND_HOLD_MS) {
          this.standUp(false, inputX, inputY);
        }
      } else {
        this.standHoldMs = 0;
      }
      return;
    }

    // WHY: Dwell timer prevents accidental sitting when merely walking past chairs.
    if (canSit) {
      let candidate: Seat | null = null;
      let bestDistance = Infinity;
      const px = this.player.x;
      const py = this.player.y;
      for (const s of this.seats) {
        if (inSeatZone(s, px, py) && this.isSeatFree(s)) {
          const d = Math.hypot(px - s.centerX, py - s.centerY);
          if (d < bestDistance) {
            bestDistance = d;
            candidate = s;
          }
        }
      }

      if (candidate) {
        if (this.seatCandidate?.id === candidate.id) {
          this.dwellMs += delta;
        } else {
          this.seatCandidate = candidate;
          this.dwellMs = delta;
        }
        if (this.dwellMs >= SIT_DWELL_MS) {
          this.sit(candidate);
          this.seatCandidate = null;
          this.dwellMs = 0;
        }
      } else {
        this.seatCandidate = null;
        this.dwellMs = 0;
      }
    } else {
      this.seatCandidate = null;
      this.dwellMs = 0;
    }
  }
}

/**
 * Remote network player entity.
 * Buffers received network positions and smoothly interpolates avatar coordinates in render ticks.
 */

import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import { Avatar, type Direction } from './Avatar';
import type { Recipe } from '../art/recipe';

interface Snapshot {
  t: number;
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  seated: boolean;
}

/** Draw other people this far in the past, between two received positions. */
const INTERPOLATION_DELAY_MS = 100;
/** Bigger jumps than this are teleports (spawn, layout change): no sliding. */
const TELEPORT_DISTANCE = 6 * TILE;
/** Maximum retained historical snapshots in the interpolation ring buffer. */
const MAX_SNAPSHOT_HISTORY = 30;
/** Movement threshold in pixels to consider the avatar actively walking between frames. */
const WALK_DETECTION_THRESHOLD_PX = 0.3;
/** No position for this long while "walking": stop the walk cycle (their stop packet was lost). */
const STALE_WALK_MS = 400;

/**
 * Another person in the office. Positions arrive ~20 times a second, at
 * uneven intervals; drawing them 100 ms late and interpolating between two
 * known positions makes the movement smooth instead of jumpy.
 */
export class RemotePlayer {
  readonly avatar: Avatar;
  private snapshots: Snapshot[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    recipe: Recipe,
    name: string,
    fontFamily: string,
    textResolution: number,
    private readonly depthOf: (x: number, y: number, seated: boolean) => number,
  ) {
    this.avatar = new Avatar(scene, x, y, recipe, name, fontFamily, textResolution);
    this.snapshots.push({ t: performance.now(), x, y, dir: 'down', moving: false, seated: false });
  }

  /** Ingests a new networked transform snapshot into the interpolation buffer. */
  push(x: number, y: number, dir: Direction, moving: boolean, seated = false) {
    const now = performance.now();
    const last = this.snapshots[this.snapshots.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > TELEPORT_DISTANCE) this.snapshots = [];
    this.snapshots.push({ t: now, x, y, dir, moving, seated });
    if (this.snapshots.length > MAX_SNAPSHOT_HISTORY) this.snapshots.splice(0, this.snapshots.length - MAX_SNAPSHOT_HISTORY);
  }

  /** Advances interpolation clock, lerps position between historical snapshots, and updates animations. */
  update(deltaMs: number) {
    const renderAt = performance.now() - INTERPOLATION_DELAY_MS;
    const s = this.snapshots;
    let x: number;
    let y: number;
    let current: Snapshot;
    if (s.length === 1 || renderAt >= s[s.length - 1].t) {
      current = s[s.length - 1];
      ({ x, y } = current);
    } else if (renderAt <= s[0].t) {
      current = s[0];
      ({ x, y } = current);
    } else {
      let i = s.length - 2;
      while (i > 0 && s[i].t > renderAt) i--;
      const a = s[i];
      const b = s[i + 1];
      const k = (renderAt - a.t) / (b.t - a.t || 1);
      x = a.x + (b.x - a.x) * k;
      y = a.y + (b.y - a.y) * k;
      current = b;
    }
    const moved = Math.abs(x - this.avatar.x) + Math.abs(y - this.avatar.y) > WALK_DETECTION_THRESHOLD_PX;
    if (x !== this.avatar.x || y !== this.avatar.y) {
      this.avatar.setPosition(x, y);
    }
    this.avatar.setSeated(current.seated);
    const depth = this.depthOf(x, y, current.seated);
    if (depth !== this.avatar.depth) {
      this.avatar.setDepth(depth);
    }
    const stale = renderAt - s[s.length - 1].t > STALE_WALK_MS;
    this.avatar.animateAs(current.dir, !current.seated && ((current.moving && !stale) || moved), deltaMs);
  }

  /** Cleans up the remote player avatar and its display elements. */
  destroy() {
    this.avatar.destroy();
  }
}

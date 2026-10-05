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
}

/** Draw other people this far in the past, between two received positions. */
const INTERPOLATION_DELAY_MS = 100;
/** Bigger jumps than this are teleports (spawn, layout change): no sliding. */
const TELEPORT_DISTANCE = 6 * TILE;

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
  ) {
    this.avatar = new Avatar(scene, x, y, recipe, name, fontFamily, textResolution);
    this.snapshots.push({ t: performance.now(), x, y, dir: 'down', moving: false });
  }

  push(x: number, y: number, dir: Direction, moving: boolean) {
    const now = performance.now();
    const last = this.snapshots[this.snapshots.length - 1];
    if (Math.hypot(x - last.x, y - last.y) > TELEPORT_DISTANCE) this.snapshots = [];
    this.snapshots.push({ t: now, x, y, dir, moving });
    if (this.snapshots.length > 30) this.snapshots.splice(0, this.snapshots.length - 30);
  }

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
    const moved = Math.abs(x - this.avatar.x) + Math.abs(y - this.avatar.y) > 0.3;
    this.avatar.setPosition(x, y);
    this.avatar.setDepth(10 + y / 100000);
    this.avatar.animateAs(current.dir, current.moving || moved, deltaMs);
  }

  destroy() {
    this.avatar.destroy();
  }
}

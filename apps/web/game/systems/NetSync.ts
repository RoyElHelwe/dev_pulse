/**
 * Network synchronization and remote player roster management for the office.
 * Tracks remote player avatars, dispatches local movement updates, and feeds proximity audio.
 */

import * as Phaser from 'phaser';
import { MIN_CHANGE_INTERVAL_MS, PROXIMITY_TICK_MS, SEND_INTERVAL_MS, TILE } from '../constants';
import { recipeOf } from '../art/recipe';
import { type Avatar, type Direction, DIRECTIONS } from '../objects/Avatar';
import { RemotePlayer } from '../objects/RemotePlayer';
import type { Proximity } from './Proximity';

/** Resolution multiplier for sharp font rendering on high-DPI displays. */
const TEXT_RESOLUTION_SCALE = 2;

/** Someone else in the office, as the network describes them. */
export interface PlayerState {
  id: string;
  name: string;
  character: string;
  x: number;
  y: number;
  dir: number;
  moving: boolean;
  seated?: boolean;
  status?: string | null;
  /** Zone they stand in (meeting room, lounge, desk id), or null. */
  zone?: string | null;
}

/** For the minimap and voice: positions in tiles, and the room each person stands in (null outside rooms). */
export interface OfficeSnapshot {
  me: { x: number; y: number; room: string | null; dir: Direction; seated: boolean };
  others: { id: string; x: number; y: number; room: string | null; dir: Direction; seated: boolean }[];
  view: { x: number; y: number; w: number; h: number };
}

/** Last broadcast movement state of the local player. */
interface SentState {
  at: number;
  moving: boolean;
  dir: Direction;
  seated: boolean;
}

/** Dependencies and callbacks required by the NetSync system. */
export interface NetSyncOptions {
  scene: Phaser.Scene;
  player: Avatar;
  myId: string;
  fontFamily: string;
  dpr: number;
  roomAt: (x: number, y: number) => string | null;
  depthOf: (x: number, y: number, seated: boolean) => number;
  onMove: (x: number, y: number, dir: number, moving: boolean, seated: boolean) => void;
  onBadgesDirty?: () => void;
}

/** Synchronizes local player position with the network and manages remote player instances. */
export class NetSync {
  /** Active remote player avatars keyed by player ID. */
  readonly remotes = new Map<string, RemotePlayer>();

  /** Current zone assignment for each remote player keyed by player ID. */
  readonly remoteZones = new Map<string, string | null>();

  /** Most recent local movement state sent across the network. */
  lastSent: SentState = { at: 0, moving: false, dir: 'down', seated: false };

  private readonly scene: Phaser.Scene;
  private readonly player: Avatar;
  private readonly myId: string;
  private readonly fontFamily: string;
  private readonly resolution: number;
  private readonly roomAt: (x: number, y: number) => string | null;
  private readonly depthOf: (x: number, y: number, seated: boolean) => number;
  private readonly onMove: (x: number, y: number, dir: number, moving: boolean, seated: boolean) => void;
  private readonly onBadgesDirty?: () => void;

  private readonly remoteTilePoints = new Map<string, { x: number; y: number }>();
  private lastProximityAt = -PROXIMITY_TICK_MS;

  constructor(opts: NetSyncOptions) {
    this.scene = opts.scene;
    this.player = opts.player;
    this.myId = opts.myId;
    this.fontFamily = opts.fontFamily;
    this.resolution = opts.dpr * TEXT_RESOLUTION_SCALE;
    this.roomAt = opts.roomAt;
    this.depthOf = opts.depthOf;
    this.onMove = opts.onMove;
    this.onBadgesDirty = opts.onBadgesDirty;
  }

  /** Captures current office positions, rooms, facing directions, and camera view for minimap. */
  snapshot(cam: { x: number; y: number; width: number; height: number }): OfficeSnapshot {
    const at = (avatar: Avatar) => ({
      x: avatar.x / TILE,
      y: avatar.y / TILE,
      room: this.roomAt(avatar.x / TILE, avatar.y / TILE),
      dir: avatar.facing,
      seated: avatar.seated,
    });
    return {
      me: at(this.player),
      others: [...this.remotes].map(([id, r]) => ({ id, ...at(r.avatar) })),
      view: { x: cam.x / TILE, y: cam.y / TILE, w: cam.width / TILE, h: cam.height / TILE },
    };
  }

  /** Sets voice activity indicators (headset and speech pulse) for local or remote player. */
  setVoice(id: string, inCall: boolean, talking: boolean): void {
    const avatar = id === this.myId ? this.player : this.remotes.get(id)?.avatar;
    avatar?.setInCall(inCall, talking);
  }

  /** Displays a temporary speech bubble above local or remote player avatar. */
  showChat(userId: string, message: string): void {
    const avatar = userId === this.myId ? this.player : this.remotes.get(userId)?.avatar;
    avatar?.say(message);
  }

  /** Returns coordinates of all remote players currently seated. */
  getSeatedPositions(): Array<{ x: number; y: number }> {
    const list: Array<{ x: number; y: number }> = [];
    for (const remote of this.remotes.values()) {
      if (remote.avatar.seated) {
        list.push({ x: remote.avatar.x, y: remote.avatar.y });
      }
    }
    return list;
  }

  /** Adds a new remote player avatar or updates an existing remote player's state. */
  upsertPlayer(p: PlayerState): void {
    const existing = this.remotes.get(p.id);
    if (existing) {
      existing.push(p.x, p.y, DIRECTIONS[p.dir] ?? 'down', p.moving, !!p.seated);
      return;
    }
    const remote = new RemotePlayer(
      this.scene,
      p.x,
      p.y,
      recipeOf(p.character),
      p.name,
      this.fontFamily,
      this.resolution,
      this.depthOf,
    );
    remote.avatar.setStatus(p.status);
    remote.push(p.x, p.y, DIRECTIONS[p.dir] ?? 'down', p.moving, !!p.seated);
    this.remotes.set(p.id, remote);
    this.setZone(p.id, p.zone ?? null);
  }

  /** Pushes a new target position and state to a remote player. */
  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean, seated = false): void {
    this.remotes.get(id)?.push(x, y, DIRECTIONS[dir] ?? 'down', moving, seated);
  }

  /** Removes a remote player from the office scene and cleans up resources. */
  removePlayer(id: string): void {
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
    this.remoteZones.delete(id);
    this.onBadgesDirty?.();
  }

  /** Tracks which zone a remote player occupies for room occupancy counters. */
  setZone(id: string, zone: string | null): void {
    this.remoteZones.set(id, zone);
    this.onBadgesDirty?.();
  }

  /** Updates the status emoji or bubble displayed above a remote player. */
  setStatus(id: string, status: string | null): void {
    this.remotes.get(id)?.avatar.setStatus(status);
  }

  /** Updates the appearance recipe for a remote player. */
  setLook(id: string, character: string): void {
    this.remotes.get(id)?.avatar.setLook(recipeOf(character));
  }

  /** Advances interpolation and walk animations for all remote players. */
  update(delta: number): void {
    for (const remote of this.remotes.values()) {
      remote.update(delta);
    }
  }

  /** Refreshes remote player positions for proximity audio at a throttled cadence. */
  updateProximity(time: number, playerTile: { x: number; y: number }, proximity: Proximity): void {
    if (time - this.lastProximityAt < PROXIMITY_TICK_MS) return;
    this.lastProximityAt = time;
    for (const id of this.remoteTilePoints.keys()) {
      if (!this.remotes.has(id)) {
        this.remoteTilePoints.delete(id);
      }
    }
    for (const [id, remote] of this.remotes) {
      const tx = remote.avatar.x / TILE;
      const ty = remote.avatar.y / TILE;
      const pt = this.remoteTilePoints.get(id);
      if (pt) {
        pt.x = tx;
        pt.y = ty;
      } else {
        this.remoteTilePoints.set(id, { x: tx, y: ty });
      }
    }
    proximity.update(time, playerTile, this.remoteTilePoints);
  }

  /** Sends local position if interval elapsed or movement/facing/seated state changed. */
  maybeSend(time: number, moving: boolean): void {
    const dir = this.player.facing;
    const seated = this.player.seated;
    const changed = moving !== this.lastSent.moving || dir !== this.lastSent.dir || seated !== this.lastSent.seated;
    const since = time - this.lastSent.at;
    // Changes go out quickly but never faster than MIN_CHANGE_INTERVAL_MS: tapping keys used to send a
    // packet per press, past the server's 40/s budget, which then dropped them (the stop included).
    // A change not sent yet stays "changed", so it goes out on a following frame.
    if ((moving && since >= SEND_INTERVAL_MS) || (changed && since >= MIN_CHANGE_INTERVAL_MS)) {
      this.lastSent = { at: time, moving, dir, seated };
      this.sendPosition(moving);
    }
  }

  /** Dispatches local player position and orientation over the network. */
  sendPosition(moving = false): void {
    this.lastSent = { at: performance.now(), moving, dir: this.player.facing, seated: this.player.seated };
    this.onMove(
      Math.round(this.player.x),
      Math.round(this.player.y),
      DIRECTIONS.indexOf(this.player.facing),
      moving,
      this.player.seated,
    );
  }

  /** Cleans up remote player instances on scene shutdown. */
  destroy(): void {
    for (const remote of this.remotes.values()) {
      remote.destroy();
    }
    this.remotes.clear();
    this.remoteZones.clear();
    this.remoteTilePoints.clear();
  }
}

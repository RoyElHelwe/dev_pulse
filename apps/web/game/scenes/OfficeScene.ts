import * as Phaser from 'phaser';
import { officeEvents } from '@/features/office/events';
import { getKeybinds } from '@/features/settings/keybinds';
import { isTyping } from '@/lib/dom';
import { TILE, WALK_SPEED } from '../constants';
import { EditMode } from '../editor/EditMode';
import type { LayoutEditor } from '../editor/LayoutEditor';
import { deriveLabels, deriveZones, itemBounds, type Rect } from '../layout/derive';
import type { Furniture, OfficeLayout, Zone } from '../layout/types';
import { Avatar, DIRECTIONS, type Direction } from '../objects/Avatar';
import { DeskPlates, type DeskOwner } from '../objects/DeskPlates';
import { recipeOf } from '../art/recipe';
import { RemotePlayer } from '../objects/RemotePlayer';
import { type RoomBooking, RoomBadges } from '../objects/RoomBadges';
import { Interactions } from '../systems/Interactions';
import { Proximity } from '../systems/Proximity';
import { roomFinder } from '../systems/rooms';
import { drawFloor } from '../render/floors';
import { FURNITURE } from '../render/furniture';
import { legoArt } from '../render/legoArt';
import { ensureFurnitureTexture, ensureShadowTexture, setDeskOwners, setDeskPapers, textureScale } from '../render/sprites';
import { drawWall, wallCollider } from '../render/walls';

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

export interface OfficeSceneData {
  layout: OfficeLayout;
  myId: string;
  character: string;
  name: string;
  status: string | null;
  /** Touch screen: hints say "Tap" instead of showing the E key. */
  touch: boolean;
  fontFamily: string;
  /** Device pixel ratio: the canvas renders at this scale to stay sharp. */
  dpr: number;
  /** Where to put the local player (kept across layout reloads); default: the entrance. */
  startAt?: { x: number; y: number };
  /** People already here (replayed after a layout reload). */
  players: () => PlayerState[];
  /** Who owns which desk (replayed after a layout reload). */
  desks: () => DeskOwner[];
  /** Open tasks per user id, for the paper stacks on desks (replayed after a layout reload). */
  taskCounts: () => ReadonlyMap<string, number>;
  /** Meeting rooms the local player may not enter (replayed after a layout reload). */
  locked: () => string[];
  /** Meeting rooms booked right now, for their badges (replayed after a layout reload). */
  bookings: () => RoomBooking[];
  /** Who is in a call and talking (replayed after a layout reload). */
  voice: () => ReadonlyMap<string, { inCall: boolean; talking: boolean }>;
  /** Called when the local player moves (to send it to the others). */
  onMove: (x: number, y: number, dir: number, moving: boolean, seated: boolean) => void;
  /** Called when the local player enters or leaves a zone (shared with the others). */
  onZone: (zoneId: string | null) => void;
}

/** For the minimap and voice: positions in tiles, and the room each person stands in (null outside rooms). */
export interface OfficeSnapshot {
  me: { x: number; y: number; room: string | null; dir: Direction; seated: boolean };
  others: { id: string; x: number; y: number; room: string | null; dir: Direction; seated: boolean }[];
  view: { x: number; y: number; w: number; h: number };
}

// Draw order: floor and walls (baked) < rugs < shadows < y-sorted (furniture + people + plates) < badges < hints.
export const DEPTH = { floor: 0, rug: 1, shadow: 2, sorted: 10, badges: 20, hints: 900 };

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.5;
/** Send the local position at most every 50 ms (20 per second) while walking. */
const SEND_INTERVAL_MS = 50;
const SIT_DWELL_MS = 500;
const STAND_HOLD_MS = 500;

interface Seat {
  id: string;
  item: Furniture;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  dir: Direction | null;
}

interface ActiveSeat extends Seat {
  dir: Direction;
}

export class OfficeScene extends Phaser.Scene {
  private opts!: OfficeSceneData;
  private player!: Avatar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private zones: Zone[] = [];
  private obstacles: Rect[] = [];
  /** Booked meeting rooms the local player can't walk into (pixels), and their colliders. */
  private locked: { roomId: string; rect: Rect }[] = [];
  private lockedSolids!: Phaser.Physics.Arcade.StaticGroup;
  private currentZone: Zone | null = null;
  private userZoom = 1;
  private remotes = new Map<string, RemotePlayer>();
  private desks: DeskOwner[] = [];
  private taskCounts: ReadonlyMap<string, number> = new Map();
  private sprites = new Map<string, { image: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; key: string }>();
  private editMode: EditMode | null = null;
  private proximity!: Proximity;
  private roomAt!: (x: number, y: number) => string | null;
  private interactions!: Interactions;
  private plates!: DeskPlates;
  private badges!: RoomBadges;
  private remoteZones = new Map<string, string | null>();
  private badgesDirty = true;
  /** Virtual joystick (touch screens), -1..1 on each axis. */
  private joystick = { x: 0, y: 0 };
  private seats: Seat[] = [];
  private seat: ActiveSeat | null = null;
  private seatCandidate: Seat | null = null;
  private dwellMs = 0;
  private standHoldMs = 0;
  private justLeft: string | null = null;
  private lastSent = { at: 0, moving: false, dir: 'down' as Direction, seated: false };

  constructor() {
    super('office');
  }

  init(data: OfficeSceneData) {
    this.opts = data;
    this.remotes = new Map();
    this.desks = [];
    this.sprites = new Map();
    this.editMode = null;
    this.remoteZones = new Map();
    this.badgesDirty = true;
    this.joystick = { x: 0, y: 0 };
    this.currentZone = null;
    this.locked = [];
    this.seats = [];
    this.seat = null;
    this.seatCandidate = null;
    this.dwellMs = 0;
    this.standHoldMs = 0;
    this.justLeft = null;
    this.lastSent = { at: 0, moving: false, dir: 'down', seated: false };
  }

  create() {
    const { layout } = this.opts;
    const worldW = layout.width * TILE;
    const worldH = layout.height * TILE;
    const solids = this.physics.add.staticGroup();
    this.obstacles = [];
    this.zones = deriveZones(layout);
    this.seats = layout.furniture
      .filter((f) => f.kind === 'chair' || f.kind === 'armchair' || f.kind === 'stool')
      .map((item) => ({
        id: item.id,
        item,
        x: item.x * TILE,
        y: item.y * TILE + 5,
        centerX: item.x * TILE,
        centerY: item.y * TILE,
        dir: item.kind === 'stool' ? null : chairFacing(item.rotation ?? 0),
      }));

    this.bakeStaticScenery(layout, worldW, worldH, solids);

    // Furniture: one image per piece (see render/sprites.ts), desks drawn for their owners.
    this.taskCounts = this.opts.taskCounts();
    setDeskOwners(this, ownersOf(this.opts.desks()));
    setDeskPapers(this, papersOf(this.opts.desks(), this.taskCounts));
    const scale = textureScale(this.opts.dpr);
    for (const item of layout.furniture) {
      this.addFurniture(item, scale);
      if (FURNITURE[item.kind].solid) {
        const b = pixels(itemBounds(item));
        this.addCollider(solids, b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      }
    }

    // Local player, at its previous place if it's still free, else near the entrance.
    const start =
      this.opts.startAt && this.isFree(this.opts.startAt.x, this.opts.startAt.y) ? this.opts.startAt : this.arrivalPoint(layout);
    this.player = new Avatar(this, start.x, start.y, recipeOf(this.opts.character), this.opts.name, this.opts.fontFamily, this.opts.dpr * 2);
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 10).setOffset(-9, -10).setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.physics.add.collider(this.player, solids);
    this.lockedSolids = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.lockedSolids);

    const text = { fontFamily: this.opts.fontFamily, resolution: this.opts.dpr * 2 };
    this.roomAt = roomFinder(layout);
    this.proximity = new Proximity(this.roomAt);
    this.plates = new DeskPlates(this, layout, { ...text, myId: this.opts.myId, depth: DEPTH.sorted + 0.9 });
    this.badges = new RoomBadges(this, layout, { ...text, depth: DEPTH.badges });
    this.interactions = new Interactions(this, layout, { ...text, myId: this.opts.myId, touch: this.opts.touch, depth: DEPTH.hints });
    this.setDesks(this.opts.desks());
    this.setRoomBookings(this.opts.bookings());
    this.setLockedRooms(this.opts.locked());
    this.player.setStatus(this.opts.status);

    for (const p of this.opts.players()) this.upsertPlayer(p);
    for (const [id, v] of this.opts.voice()) this.setVoice(id, v.inCall, v.talking);

    // Keyboard: arrows + WASD. No key capture, so text inputs keep working.
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP, false),
      down: kb.addKey(K.DOWN, false),
      left: kb.addKey(K.LEFT, false),
      right: kb.addKey(K.RIGHT, false),
      w: kb.addKey(K.W, false),
      a: kb.addKey(K.A, false),
      s: kb.addKey(K.S, false),
      d: kb.addKey(K.D, false),
    };
    // E uses what you stand next to. A DOM listener: one call per press, whatever the frame rate.
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== getKeybinds().interact || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!isTyping() && !this.editMode) this.interactions.trigger();
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    // Tapping the "Use" hint does the same as E.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.editMode && this.interactions.hits(p.worldX, p.worldY)) this.interactions.trigger();
    });

    const cam = this.cameras.main;
    cam.setBackgroundColor('#e4e0da');
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setZoom(this.targetZoom());
    cam.centerOn(this.player.x, this.player.y);

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 1 / 1.12 : 1.12);
    });
    this.scale.on('resize', this.onResize, this);
    const unsubLego = legoArt.subscribe((objectId) => {
      this.updateLegoBoard(objectId);
    });
    this.events.once('shutdown', () => {
      unsubLego();
      this.editMode?.destroy();
      this.editMode = null;
      this.proximity.clear();
      this.interactions.destroy();
      this.opts.onZone(null);
      this.scale.off('resize', this.onResize, this);
      if (this.currentZone) officeEvents.emit('zone:leave', toEvent(this.currentZone));
    });
    this.sendPosition(true);
  }

  update(time: number, delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const typing = isTyping();

    if (this.justLeft) {
      const leftSeat = this.seats.find((s) => s.id === this.justLeft);
      if (!leftSeat || !inSeatZone(leftSeat, this.player.x, this.player.y)) {
        this.justLeft = null;
      }
    }

    let ix = 0;
    let iy = 0;
    let speed = WALK_SPEED;
    if (!typing && !this.editMode) {
      const k = this.keys;
      ix = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
      iy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
      if (ix === 0 && iy === 0 && (this.joystick.x !== 0 || this.joystick.y !== 0)) {
        ix = this.joystick.x;
        iy = this.joystick.y;
        speed = WALK_SPEED * Math.min(1, Math.hypot(ix, iy));
      }
    }

    if (this.seat) {
      body.setVelocity(0, 0);
      body.reset(this.seat.x, this.seat.y);
      this.player.animateAs(this.seat.dir, false, delta);

      const hasInput = (ix !== 0 || iy !== 0) && !typing;
      if (hasInput) {
        this.standHoldMs += delta;
        if (this.standHoldMs >= STAND_HOLD_MS) {
          this.standUp(false, ix, iy);
        }
      } else {
        this.standHoldMs = 0;
      }
    } else {
      const v = new Phaser.Math.Vector2(ix, iy).normalize().scale(speed);
      body.setVelocity(v.x, v.y);
      this.player.animate(body.velocity.x, body.velocity.y, delta);

      if (!typing && !this.editMode) {
        const matchingSeats = this.seats.filter((s) => inSeatZone(s, this.player.x, this.player.y) && this.isSeatFree(s));
        let candidate: Seat | null = null;
        if (matchingSeats.length === 1) {
          candidate = matchingSeats[0];
        } else if (matchingSeats.length > 1) {
          matchingSeats.sort(
            (a, b) =>
              Math.hypot(this.player.x - a.centerX, this.player.y - a.centerY) -
              Math.hypot(this.player.x - b.centerX, this.player.y - b.centerY),
          );
          candidate = matchingSeats[0];
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

    this.player.setDepth(this.peopleDepth(this.player.x, this.player.y, this.player.seated));
    for (const remote of this.remotes.values()) remote.update(delta);
    this.maybeSend(time, body.velocity.x !== 0 || body.velocity.y !== 0);
    this.updateZone();
    this.interactions.update(this.player.x, this.player.y, !this.editMode);
    this.proximity.update(time, { x: this.player.x / TILE, y: this.player.y / TILE }, this.remoteTiles());
    if (this.badgesDirty) this.refreshBadges();
  }

  // ---- other people ----------------------------------------------------------

  upsertPlayer(p: PlayerState) {
    const existing = this.remotes.get(p.id);
    if (existing) return existing.push(p.x, p.y, DIRECTIONS[p.dir] ?? 'down', p.moving, !!p.seated);
    const remote = new RemotePlayer(
      this,
      p.x,
      p.y,
      recipeOf(p.character),
      p.name,
      this.opts.fontFamily,
      this.opts.dpr * 2,
      (x, y, s) => this.peopleDepth(x, y, s),
    );
    remote.avatar.setStatus(p.status);
    remote.push(p.x, p.y, DIRECTIONS[p.dir] ?? 'down', p.moving, !!p.seated);
    this.remotes.set(p.id, remote);
    this.setPlayerZone(p.id, p.zone ?? null);
  }

  setPlayerZone(id: string, zone: string | null) {
    this.remoteZones.set(id, zone);
    this.badgesDirty = true;
  }

  setPlayerStatus(id: string, status: string | null) {
    this.remotes.get(id)?.avatar.setStatus(status);
  }

  setVoice(id: string, inCall: boolean, talking: boolean) {
    const avatar = id === this.opts.myId ? this.player : this.remotes.get(id)?.avatar;
    avatar?.setInCall(inCall, talking);
  }

  setOwnStatus(status: string | null) {
    this.opts.status = status;
    this.player.setStatus(status);
  }

  setDesks(desks: DeskOwner[]) {
    this.desks = desks;
    this.plates.set(desks);
    this.interactions.setOwners(desks);
    this.redecorateDesks();
  }

  /** Chat: `message` appears over `userId`'s head (yours or someone else's). */
  showChat(userId: string, message: string) {
    const avatar = userId === this.opts.myId ? this.player : this.remotes.get(userId)?.avatar;
    avatar?.say(message);
  }

  /** Open tasks per user: each desk's paper stack follows its owner's count. */
  setTaskCounts(counts: ReadonlyMap<string, number>) {
    this.taskCounts = counts;
    this.redecorateDesks();
  }

  /** Desks show their owner's things (mug in their colour, their kind of clutter...). */
  private redecorateDesks() {
    setDeskOwners(this, ownersOf(this.desks));
    setDeskPapers(this, papersOf(this.desks, this.taskCounts));
    const scale = textureScale(this.opts.dpr);
    const items = this.editMode ? [] : this.opts.layout.furniture.filter((f) => f.kind === 'desk');
    for (const item of items) {
      const sprite = this.sprites.get(item.id);
      if (!sprite) continue;
      const key = ensureFurnitureTexture(this, item, scale);
      if (key === sprite.key) continue;
      const old = sprite.key;
      sprite.image.setTexture(key);
      sprite.key = key;
      // Desk textures are per desk and owner: nobody else uses the old one.
      if (this.textures.exists(old)) this.textures.remove(old);
    }
  }

  /** Lego wall boards redraw when art is placed/erased. */
  private updateLegoBoard(objectId?: string) {
    const scale = textureScale(this.opts.dpr);
    const items = this.editMode ? [] : this.opts.layout.furniture.filter((f) => f.kind === 'legoBoard' && (!objectId || f.id === objectId));
    for (const item of items) {
      const sprite = this.sprites.get(item.id);
      if (!sprite) continue;
      const key = ensureFurnitureTexture(this, item, scale);
      if (key === sprite.key) continue;
      const old = sprite.key;
      sprite.image.setTexture(key);
      sprite.key = key;
      if (old.includes(':lego') && this.textures.exists(old)) {
        this.textures.remove(old);
      }
    }
  }

  /** Someone changed character: their avatar and their desk follow. */
  private ownerChanged(userId: string, character: string) {
    if (!this.desks.some((d) => d.userId === userId)) return;
    this.desks = this.desks.map((d) => (d.userId === userId ? { ...d, character } : d));
    this.redecorateDesks();
  }

  // ---- booked meeting rooms ---------------------------------------------------------

  /**
   * Rooms booked without us become solid: a collider covers the whole room, so
   * its doorways are closed. Someone already inside is sent back to the entrance.
   * Returns the id of the room they were moved out of, or null.
   */
  setLockedRooms(roomIds: string[]): string | null {
    const ids = new Set(roomIds);
    this.locked = this.opts.layout.rooms
      .filter((r) => r.kind === 'meeting' && ids.has(r.id))
      .map((r) => ({ roomId: r.id, rect: pixels(r) }));
    this.lockedSolids.clear(true, true);
    for (const { rect } of this.locked) {
      this.lockedSolids.add(this.add.zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h));
    }
    const inside = this.locked.find(({ rect }) => overlapsRect(playerBody(this.player.x, this.player.y), rect));
    if (!inside) return null;
    if (this.seat) this.standUp(true);
    const to = this.arrivalPoint(this.opts.layout);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(to.x, to.y);
    this.cameras.main.centerOn(to.x, to.y);
    this.sendPosition();
    this.updateZone();
    return inside.roomId;
  }

  setRoomBookings(bookings: RoomBooking[]) {
    this.badges.setBookings(bookings);
  }

  setJoystick(x: number, y: number) {
    this.joystick = { x, y };
  }

  snapshot(): OfficeSnapshot {
    const cam = this.cameras.main.worldView;
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

  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean, seated = false) {
    this.remotes.get(id)?.push(x, y, DIRECTIONS[dir] ?? 'down', moving, seated);
  }

  removePlayer(id: string) {
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
    this.remoteZones.delete(id);
    this.badgesDirty = true;
  }

  setPlayerCharacter(id: string, character: string) {
    this.remotes.get(id)?.avatar.setLook(recipeOf(character));
    this.ownerChanged(id, character);
  }

  setOwnLook(character: string) {
    this.player.setLook(recipeOf(character));
    this.opts.character = character;
    this.ownerChanged(this.opts.myId, character);
  }

  /** Current local position (kept when the layout reloads). */
  localPosition() {
    return { x: this.player.x, y: this.player.y };
  }

  // ---- editing -----------------------------------------------------------------

  /** Organisers: switch to editing (the player stops, the camera is free). */
  startEditing(editor: LayoutEditor, onProblem: (text: string) => void) {
    if (this.editMode) return;
    if (this.seat) this.standUp(true);
    this.cameras.main.stopFollow();
    this.plates.setVisible(false);
    this.editMode = new EditMode(
      {
        scene: this,
        textureScale: textureScale(this.opts.dpr),
        sprites: this.sprites,
        depthOf: (item) => this.furnitureDepth(item),
        shadowDepth: DEPTH.shadow,
      },
      editor,
      onProblem,
    );
  }

  // ---- view --------------------------------------------------------------------

  zoomBy(factor: number) {
    this.userZoom = Phaser.Math.Clamp(this.userZoom * factor, ZOOM_MIN, ZOOM_MAX);
    this.cameras.main.zoomTo(this.targetZoom(), 160, 'Sine.easeOut', true);
  }

  resetView() {
    this.userZoom = 1;
    this.cameras.main.zoomTo(this.targetZoom(), 220, 'Sine.easeOut', true);
  }

  // ---- internals ---------------------------------------------------------------

  private maybeSend(time: number, moving: boolean) {
    const dir = this.player.facing;
    const seated = this.player.seated;
    const changed = moving !== this.lastSent.moving || dir !== this.lastSent.dir || seated !== this.lastSent.seated;
    if ((moving && time - this.lastSent.at >= SEND_INTERVAL_MS) || changed) {
      this.lastSent = { at: time, moving, dir, seated };
      this.sendPosition(moving);
    }
  }

  private sendPosition(moving = false) {
    this.lastSent = { at: performance.now(), moving, dir: this.player.facing, seated: this.player.seated };
    this.opts.onMove(
      Math.round(this.player.x),
      Math.round(this.player.y),
      DIRECTIONS.indexOf(this.player.facing),
      moving,
      this.player.seated,
    );
  }

  private isSeatFree(seat: Seat): boolean {
    if (seat.id === this.justLeft) return false;
    for (const remote of this.remotes.values()) {
      if (remote.avatar.seated && Math.hypot(remote.avatar.x - seat.x, remote.avatar.y - seat.y) <= 14) {
        return false;
      }
    }
    return true;
  }

  private sit(seat: Seat) {
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

  private standUp(forced = false, ix = 0, iy = 0) {
    if (!this.seat) return;
    const seat = this.seat;
    const seatId = seat.id;
    const front = seat.dir;
    const primaryDir = forced ? null : inputDirection(ix, iy);

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

  private addFurniture(item: Furniture, scale: number) {
    const b = pixels(itemBounds(item));
    const shadow = FURNITURE[item.kind].solid
      ? this.add
          .image(b.x + 1, b.y + 4, ensureShadowTexture(this, item, scale))
          .setOrigin(0)
          .setScale(1 / scale)
          .setDepth(DEPTH.shadow)
      : undefined;
    const key = ensureFurnitureTexture(this, item, scale);
    const image = this.add
      .image(item.x * TILE, item.y * TILE, key)
      .setScale(1 / scale)
      .setRotation(Phaser.Math.DegToRad(item.rotation ?? 0))
      .setDepth(this.furnitureDepth(item))
      .setData('furnitureId', item.id);
    this.sprites.set(item.id, { image, shadow, key });
  }

  /** Rugs on the floor, the rest sorted by their bottom edge (things lower on screen are in front). */
  private furnitureDepth(item: Furniture) {
    const spec = FURNITURE[item.kind];
    const b = pixels(itemBounds(item));
    return spec.layer === 'floor' ? DEPTH.rug : DEPTH.sorted + (b.y + b.h) / 100000;
  }

  private peopleDepth(x: number, y: number, seated = false): number {
    if (seated) {
      const seat = this.seats.find((s) => Math.hypot(x - s.centerX, y - s.centerY) <= 24);
      if (seat) return this.furnitureDepth(seat.item) + 0.000001;
    }
    return DEPTH.sorted + y / 100000;
  }

  private addCollider(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number, h: number) {
    this.obstacles.push({ x, y, w, h });
    group.add(this.add.zone(x + w / 2, y + h / 2, w, h));
  }

  /** A free spot around the entrance, so people arriving together don't stand on each other. */
  private arrivalPoint(layout: OfficeLayout) {
    const spawn = { x: layout.spawn.x * TILE, y: layout.spawn.y * TILE };
    for (let attempt = 0; attempt < 20; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      // Close to the door: two people arriving together are within earshot (< 3 tiles apart).
      const distance = TILE * (0.5 + Math.random() * 0.9);
      const x = spawn.x + Math.cos(angle) * distance;
      const y = spawn.y + Math.sin(angle) * distance * 0.6;
      if (this.isFree(x, y) && y < layout.height * TILE - 4) return { x, y };
    }
    return spawn;
  }

  /** True if the player's body fits at these feet coordinates (inside the office). */
  private isFree(x: number, y: number) {
    const { width, height } = this.opts.layout;
    if (x < TILE / 2 || y < TILE || x > (width - 0.5) * TILE || y > (height - 0.5) * TILE) return false;
    const body = playerBody(x, y);
    return !this.obstacles.some((o) => overlapsRect(body, o)) && !this.locked.some(({ rect }) => overlapsRect(body, rect));
  }

  /**
   * Floors, walls and room names never change while playing: draw them once
   * into a few large textures instead of redrawing hundreds of shapes per frame.
   */
  private bakeStaticScenery(layout: OfficeLayout, worldW: number, worldH: number, solids: Phaser.Physics.Arcade.StaticGroup) {
    const scenery: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];
    const floor = this.add.graphics();
    layout.rooms.forEach((room) => drawFloor(floor, room));
    scenery.push(floor);

    // Vertical walls under horizontal ones; horizontal ones from north to south.
    const walls = [...layout.walls].sort((a, b) => Number(a.y1 === a.y2) - Number(b.y1 === b.y2) || a.y1 - b.y1);
    for (const wall of walls) {
      const g = this.add.graphics();
      drawWall(g, wall);
      scenery.push(g);
      const r = wallCollider(wall);
      this.addCollider(solids, r.x, r.y, r.w, r.h);
    }

    for (const label of deriveLabels(layout)) {
      scenery.push(
        this.add
          .text(label.x * TILE, label.y * TILE, label.text, {
            fontFamily: this.opts.fontFamily,
            fontSize: '13px',
            fontStyle: '700',
            color: label.tone === 'dark' ? '#3f3f46' : '#ffffff',
          })
          .setOrigin(0.5)
          .setAlpha(label.tone === 'dark' ? 0.4 : 0.55)
          .setLetterSpacing(4)
          .setResolution(this.opts.dpr * 2),
      );
    }

    // Texture pixels per world pixel, capped so big offices stay within GPU memory.
    const scale = Math.min(3, this.opts.dpr * 1.5, Math.sqrt(16e6 / (worldW * worldH)));
    const CHUNK = 512;
    const PAD = 2;
    for (let cy = 0; cy < worldH; cy += CHUNK) {
      for (let cx = 0; cx < worldW; cx += CHUNK) {
        const w = Math.min(CHUNK, worldW - cx) + PAD * 2;
        const h = Math.min(CHUNK, worldH - cy) + PAD * 2;
        const rt = this.add
          .renderTexture(cx - PAD, cy - PAD, Math.ceil(w * scale), Math.ceil(h * scale))
          .setOrigin(0)
          .setScale(1 / scale)
          .setDepth(DEPTH.floor);
        for (const o of scenery) {
          const { x, y, scaleX, scaleY } = o;
          o.setPosition((x - cx + PAD) * scale, (y - cy + PAD) * scale).setScale(scaleX * scale, scaleY * scale);
          rt.draw(o);
          o.setPosition(x, y).setScale(scaleX, scaleY);
        }
      }
    }
    scenery.forEach((o) => o.destroy());
  }

  /** Zoom that keeps characters a comfortable size on any screen. */
  private targetZoom() {
    const { dpr, layout } = this.opts;
    const cam = this.cameras.main;
    const base = Phaser.Math.Clamp(cam.width / dpr / (26 * TILE), 0.75, 1.5);
    // Never zoom out further than the office itself (no empty space around it).
    const cover = Math.max(cam.width / (layout.width * TILE), cam.height / (layout.height * TILE));
    return Math.max(base * this.userZoom * dpr, cover);
  }

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.cameras.main.setZoom(this.targetZoom());
  }

  private *remoteTiles(): Iterable<[string, { x: number; y: number }]> {
    for (const [id, r] of this.remotes) yield [id, { x: r.avatar.x / TILE, y: r.avatar.y / TILE }];
  }

  /** People per meeting room, from everyone's reported zone (and ours). */
  private refreshBadges() {
    this.badgesDirty = false;
    const counts = new Map<string, number>();
    const add = (zone: string | null | undefined) => zone && counts.set(zone, (counts.get(zone) ?? 0) + 1);
    for (const zone of this.remoteZones.values()) add(zone);
    add(this.currentZone?.id);
    this.badges.update(counts);
  }

  /** Emits zone:leave / zone:enter when the player's feet cross into a zone. */
  private updateZone() {
    const px = this.player.x / TILE;
    const py = this.player.y / TILE;
    const zone = this.zones.find((z) => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) ?? null;
    if (zone?.id === this.currentZone?.id) return;
    if (this.currentZone) officeEvents.emit('zone:leave', toEvent(this.currentZone));
    if (zone) officeEvents.emit('zone:enter', toEvent(zone));
    this.currentZone = zone;
    this.opts.onZone(zone?.id ?? null);
    this.badgesDirty = true;
  }
}

// (helpers)

function chairFacing(deg = 0): Direction {
  const r = ((deg % 360) + 360) % 360;
  if (r === 90) return 'right';
  if (r === 180) return 'down';
  if (r === 270) return 'left';
  return 'up';
}

function inSeatZone(seat: Seat, px: number, py: number): boolean {
  if (seat.item.kind === 'armchair') {
    const b = pixels(itemBounds(seat.item));
    return px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 8 && py <= b.y + b.h + 8;
  }
  return Math.hypot(px - seat.centerX, py - seat.centerY) <= TILE * 0.45;
}

function inputDirection(ix: number, iy: number): Direction | null {
  if (ix === 0 && iy === 0) return null;
  if (Math.abs(ix) > Math.abs(iy)) {
    return ix > 0 ? 'right' : 'left';
  }
  return iy > 0 ? 'down' : 'up';
}

const STEP_OFF_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -22 },
  down: { dx: 0, dy: 22 },
  left: { dx: -22, dy: 0 },
  right: { dx: 22, dy: 0 },
};

function pixels(r: Rect): Rect {
  return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
}

/** The local player's physics body (18 × 10 px) for feet at x, y. */
function playerBody(x: number, y: number): Rect {
  return { x: x - 9, y: y - 10, w: 18, h: 10 };
}

function overlapsRect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function toEvent(zone: Zone) {
  return { type: zone.type, id: zone.id, name: zone.name };
}

/** Desk id → its owner's character. */
function ownersOf(desks: DeskOwner[]) {
  return new Map(desks.filter((d) => d.character).map((d) => [d.deskId, d.character!]));
}

/** Desk id → how many open tasks its owner has. */
function papersOf(desks: DeskOwner[], counts: ReadonlyMap<string, number>) {
  return new Map(desks.map((d) => [d.deskId, counts.get(d.userId) ?? 0]));
}

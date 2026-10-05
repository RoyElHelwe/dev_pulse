import * as Phaser from 'phaser';
import { officeEvents } from '@/features/office/events';
import { TILE, WALK_SPEED } from '../constants';
import { EditMode } from '../editor/EditMode';
import type { LayoutEditor } from '../editor/LayoutEditor';
import { deriveLabels, deriveZones, itemBounds, type Rect } from '../layout/derive';
import type { Furniture, OfficeLayout, Zone } from '../layout/types';
import { Avatar, DIRECTIONS, type Direction } from '../objects/Avatar';
import { DeskPlates, type DeskOwner } from '../objects/DeskPlates';
import { lookOf } from '../objects/looks';
import { RemotePlayer } from '../objects/RemotePlayer';
import { RoomBadges } from '../objects/RoomBadges';
import { Interactions } from '../systems/Interactions';
import { Proximity } from '../systems/Proximity';
import { roomFinder } from '../systems/rooms';
import { drawFloor } from '../render/floors';
import { FURNITURE } from '../render/furniture';
import { ensureFurnitureTexture, ensureShadowTexture, textureScale } from '../render/sprites';
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
  /** Called when the local player moves (to send it to the others). */
  onMove: (x: number, y: number, dir: number, moving: boolean) => void;
  /** Called when the local player enters or leaves a zone (shared with the others). */
  onZone: (zoneId: string | null) => void;
}

/** For the minimap: positions in tiles. */
export interface OfficeSnapshot {
  me: { x: number; y: number };
  others: { id: string; x: number; y: number }[];
  view: { x: number; y: number; w: number; h: number };
}

// Draw order: floor and walls (baked) < rugs < shadows < furniture < people.
export const DEPTH = { floor: 0, rug: 1, shadow: 2, furniture: 3, plates: 4, badges: 9, people: 10, hints: 900 };

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.5;
/** Send the local position at most every 50 ms (20 per second) while walking. */
const SEND_INTERVAL_MS = 50;

export class OfficeScene extends Phaser.Scene {
  private opts!: OfficeSceneData;
  private player!: Avatar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private zones: Zone[] = [];
  private obstacles: Rect[] = [];
  private currentZone: Zone | null = null;
  private userZoom = 1;
  private remotes = new Map<string, RemotePlayer>();
  private sprites = new Map<string, { image: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Image; key: string }>();
  private editMode: EditMode | null = null;
  private proximity!: Proximity;
  private interactions!: Interactions;
  private plates!: DeskPlates;
  private badges!: RoomBadges;
  private remoteZones = new Map<string, string | null>();
  private badgesDirty = true;
  /** Virtual joystick (touch screens), -1..1 on each axis. */
  private joystick = { x: 0, y: 0 };
  private lastSent = { at: 0, moving: false, dir: 'down' as Direction };

  constructor() {
    super('office');
  }

  init(data: OfficeSceneData) {
    this.opts = data;
    this.remotes = new Map();
    this.sprites = new Map();
    this.editMode = null;
    this.remoteZones = new Map();
    this.badgesDirty = true;
    this.joystick = { x: 0, y: 0 };
    this.currentZone = null;
    this.lastSent = { at: 0, moving: false, dir: 'down' };
  }

  create() {
    const { layout } = this.opts;
    const worldW = layout.width * TILE;
    const worldH = layout.height * TILE;
    const solids = this.physics.add.staticGroup();
    this.obstacles = [];
    this.zones = deriveZones(layout);

    this.bakeStaticScenery(layout, worldW, worldH, solids);

    // Furniture: one image per piece (see render/sprites.ts).
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
    this.player = new Avatar(this, start.x, start.y, lookOf(this.opts.character), this.opts.name, this.opts.fontFamily, this.opts.dpr * 2);
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 10).setOffset(-9, -10).setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.physics.add.collider(this.player, solids);

    const text = { fontFamily: this.opts.fontFamily, resolution: this.opts.dpr * 2 };
    this.proximity = new Proximity(roomFinder(layout));
    this.plates = new DeskPlates(this, layout, { ...text, myId: this.opts.myId, depth: DEPTH.plates });
    this.badges = new RoomBadges(this, layout, { ...text, depth: DEPTH.badges });
    this.interactions = new Interactions(this, layout, { ...text, myId: this.opts.myId, touch: this.opts.touch, depth: DEPTH.hints });
    this.setDesks(this.opts.desks());
    this.player.setStatus(this.opts.status);

    for (const p of this.opts.players()) this.upsertPlayer(p);

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
      if (e.key.toLowerCase() !== 'e' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
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
    this.events.once('shutdown', () => {
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
    let vx = 0;
    let vy = 0;
    let speed = WALK_SPEED;
    if (!isTyping() && !this.editMode) {
      const k = this.keys;
      vx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
      vy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
      if (vx === 0 && vy === 0 && (this.joystick.x !== 0 || this.joystick.y !== 0)) {
        vx = this.joystick.x;
        vy = this.joystick.y;
        speed = WALK_SPEED * Math.min(1, Math.hypot(vx, vy));
      }
    }
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
    body.setVelocity(v.x, v.y);

    this.player.setDepth(DEPTH.people + this.player.y / 100000);
    this.player.animate(body.velocity.x, body.velocity.y, delta);
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
    if (existing) return existing.push(p.x, p.y, DIRECTIONS[p.dir] ?? 'down', p.moving);
    const remote = new RemotePlayer(this, p.x, p.y, lookOf(p.character), p.name, this.opts.fontFamily, this.opts.dpr * 2);
    remote.avatar.setStatus(p.status);
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

  setOwnStatus(status: string | null) {
    this.opts.status = status;
    this.player.setStatus(status);
  }

  setDesks(desks: DeskOwner[]) {
    this.plates.set(desks);
    this.interactions.setOwners(desks);
  }

  setJoystick(x: number, y: number) {
    this.joystick = { x, y };
  }

  snapshot(): OfficeSnapshot {
    const cam = this.cameras.main.worldView;
    return {
      me: { x: this.player.x / TILE, y: this.player.y / TILE },
      others: [...this.remotes].map(([id, r]) => ({ id, x: r.avatar.x / TILE, y: r.avatar.y / TILE })),
      view: { x: cam.x / TILE, y: cam.y / TILE, w: cam.width / TILE, h: cam.height / TILE },
    };
  }

  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean) {
    this.remotes.get(id)?.push(x, y, DIRECTIONS[dir] ?? 'down', moving);
  }

  removePlayer(id: string) {
    this.remotes.get(id)?.destroy();
    this.remotes.delete(id);
    this.remoteZones.delete(id);
    this.badgesDirty = true;
  }

  setPlayerCharacter(id: string, character: string) {
    this.remotes.get(id)?.avatar.setLook(lookOf(character));
  }

  setOwnLook(character: string) {
    this.player.setLook(lookOf(character));
    this.opts.character = character;
  }

  /** Current local position (kept when the layout reloads). */
  localPosition() {
    return { x: this.player.x, y: this.player.y };
  }

  // ---- editing -----------------------------------------------------------------

  /** Organisers: switch to editing (the player stops, the camera is free). */
  startEditing(editor: LayoutEditor, onProblem: (text: string) => void) {
    if (this.editMode) return;
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
    const changed = moving !== this.lastSent.moving || dir !== this.lastSent.dir;
    if ((moving && time - this.lastSent.at >= SEND_INTERVAL_MS) || changed) {
      this.lastSent = { at: time, moving, dir };
      this.sendPosition(moving);
    }
  }

  private sendPosition(moving = false) {
    this.opts.onMove(Math.round(this.player.x), Math.round(this.player.y), DIRECTIONS.indexOf(this.player.facing), moving);
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
    return spec.layer === 'floor' ? DEPTH.rug : DEPTH.furniture + (b.y + b.h + (spec.layer === 'wall' ? 40 : 0)) / 100000;
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
      const distance = TILE * (0.6 + Math.random() * 1.6);
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
    const body = { x: x - 9, y: y - 10, w: 18, h: 10 };
    return !this.obstacles.some((o) => body.x < o.x + o.w && o.x < body.x + body.w && body.y < o.y + o.h && o.y < body.y + body.h);
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

function pixels(r: Rect): Rect {
  return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
}

function toEvent(zone: Zone) {
  return { type: zone.type, id: zone.id, name: zone.name };
}

function isTyping() {
  const el = document.activeElement;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

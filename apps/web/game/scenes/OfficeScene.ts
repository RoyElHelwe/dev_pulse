/**
 * Main office scene lifecycle, coordinating rendering, physics, systems, and networking.
 * Delegates specialized behaviors to dedicated systems and exposes the public office API.
 */

import * as Phaser from 'phaser';
import { officeEvents } from '@/features/office/events';
import { getKeybinds } from '@/features/settings/keybindStore';
import { isTyping } from '@/lib/dom';
import {
  DESK_PLATE_DEPTH_OFFSET,
  PLAYER_BODY_HEIGHT_PX,
  PLAYER_BODY_OFFSET_X_PX,
  PLAYER_BODY_OFFSET_Y_PX,
  PLAYER_BODY_WIDTH_PX,
  TILE,
  WALK_SPEED,
} from '../constants';
import { EditMode } from '../editor/EditMode';
import type { LayoutEditor } from '../editor/LayoutEditor';
import { deriveZones } from '../layout/derive';
import { itemBounds, type Rect } from '../layout/geometry';
import type { OfficeLayout, Zone } from '../layout/types';
import { Avatar, beginTextureBudget, type Direction } from '../objects/Avatar';
import { DeskPlates, type DeskOwner } from '../objects/DeskPlates';
import { recipeOf } from '../art/recipe';
import { type RoomBooking, RoomBadges } from '../objects/RoomBadges';
import { Interactions } from '../systems/Interactions';
import { Proximity } from '../systems/Proximity';
import { roomFinder } from '../systems/rooms';
import { FURNITURE } from '../render/furniture';
import { legoArt } from '../render/legoArt';
import { textureScale } from '../render/sprites';
import type { WallFaces } from '../render/wallFaces';
import { wallCollider } from '../render/walls';
import { DEPTH, furnitureDepth, peopleDepth } from '../systems/Depth';
import { bakeStaticScenery, createWallFaces } from '../render/scenery';
import { ViewControl } from '../systems/ViewControl';
import { overlapsRect, pixels, playerBody, RoomLocks } from '../systems/RoomLocks';
import { NetSync, type PlayerState } from '../systems/NetSync';
import { Seating } from '../systems/Seating';
import { FurnitureSprites } from '../systems/FurnitureSprites';

export type { PlayerState };

/** Inset in pixels applied to solid furniture colliders to allow smoother walking nearby. */
const FURNITURE_COLLIDER_INSET_PX = 2;

/** Number of random spawn attempts when finding an arrival spot near the entrance. */
const SPAWN_ATTEMPTS = 20;

/** Margin in pixels from the bottom map edge when choosing a spawn spot. */
const SPAWN_BOTTOM_MARGIN_PX = 4;

/** Resolution scale multiplier for crisp high-DPI text badges and avatar labels. */
const TEXT_RESOLUTION_SCALE = 2;

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

export class OfficeScene extends Phaser.Scene {
  private opts!: OfficeSceneData;
  private player!: Avatar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private zones: Zone[] = [];
  private obstacles: Rect[] = [];
  private roomLocks!: RoomLocks;
  private viewControl!: ViewControl;
  private seating!: Seating;
  private netSync!: NetSync;
  private furnitureSprites!: FurnitureSprites;
  private currentZone: Zone | null = null;
  private desks: DeskOwner[] = [];
  private taskCounts: ReadonlyMap<string, number> = new Map();
  private editMode: EditMode | null = null;
  private proximity!: Proximity;
  private roomAt!: (x: number, y: number) => string | null;
  private interactions!: Interactions;
  private plates!: DeskPlates;
  private badges!: RoomBadges;
  private badgesDirty = true;
  private wallFaces!: WallFaces;
  private readonly crowd: Array<{ x: number; y: number }> = [];
  /** Virtual joystick (touch screens), -1..1 on each axis. */
  private joystick = { x: 0, y: 0 };
  private readonly moveVec = new Phaser.Math.Vector2();
  private lastZoneX = NaN;
  private lastZoneY = NaN;
  /** True while a full-screen game covers the office: the scene keeps ticking but ignores the keyboard. */
  private inputBlocked = false;

  constructor() {
    super('office');
  }

  // ---- lifecycle --------------------------------------------------------------

  /** Initializes the scene state with incoming office data before creation. */
  init(data: OfficeSceneData) {
    this.opts = data;
    this.desks = [];
    this.furnitureSprites = new FurnitureSprites({
      scene: this,
      getLayout: () => this.opts.layout,
      getDpr: () => this.opts.dpr,
      isEditing: () => Boolean(this.editMode),
    });
    this.editMode = null;
    this.badgesDirty = true;
    this.joystick = { x: 0, y: 0 };
    this.currentZone = null;
    this.lastZoneX = NaN;
    this.lastZoneY = NaN;
    this.inputBlocked = false;
  }

  /** Builds scenery, physics solids, player avatar, systems, view controls, and event listeners. */
  create() {
    const { layout } = this.opts;
    const worldW = layout.width * TILE;
    const worldH = layout.height * TILE;
    const solids = this.physics.add.staticGroup();

    this.setupScenery(worldW, worldH, solids);
    this.setupFurniture(solids);
    this.setupPlayer(worldW, worldH, solids);
    this.setupSystems();
    this.setupInput();
    this.setupView();
    this.setupEventHandlers();
    this.netSync.sendPosition(true);
  }

  // ---- input ------------------------------------------------------------------

  /** Blocks or unblocks local player keyboard movement (e.g. while a modal or mini-game is open). */
  setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked;
  }

  /** Sets virtual touch joystick input vector (-1..1 on each axis). */
  setJoystick(x: number, y: number) {
    this.joystick = { x, y };
  }

  // ---- update loop ------------------------------------------------------------

  /** Per-frame game loop updating player motion, network synchronization, scenery, and systems. */
  update(time: number, delta: number) {
    beginTextureBudget();
    this.updatePlayerMovement(delta);
    this.netSync.update(delta);
    this.updateScenery(delta);
    this.updateSystems(time);
  }

  private updatePlayerMovement(delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const typing = isTyping() || this.inputBlocked;
    const canAct = !typing && !this.editMode;

    let ix = 0;
    let iy = 0;
    let speed = WALK_SPEED;
    if (canAct) {
      const k = this.keys;
      ix = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
      iy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
      if (ix === 0 && iy === 0 && (this.joystick.x !== 0 || this.joystick.y !== 0)) {
        ix = this.joystick.x;
        iy = this.joystick.y;
        speed = WALK_SPEED * Math.min(1, Math.hypot(ix, iy));
      }
    }

    if (this.seating.isSeated) {
      this.seating.update(delta, ix, iy, canAct);
    } else {
      const v = this.moveVec.set(ix, iy).normalize().scale(speed);
      body.setVelocity(v.x, v.y);
      this.player.animate(body.velocity.x, body.velocity.y, delta);
      this.seating.update(delta, ix, iy, canAct);
    }

    const depth = peopleDepth(this.player.x, this.player.y, this.player.seated, this.seating.seats, this.opts.layout.walls);
    if (depth !== this.player.depth) {
      this.player.setDepth(depth);
    }
  }

  private updateScenery(delta: number) {
    this.crowd.length = 0;
    this.crowd.push(this.player);
    for (const remote of this.netSync.remotes.values()) this.crowd.push(remote.avatar);
    this.wallFaces.update(delta, this.crowd);
    this.furnitureSprites.updateWallAlpha(this.wallFaces);
  }

  private updateSystems(time: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    this.netSync.maybeSend(time, body.velocity.x !== 0 || body.velocity.y !== 0);
    this.updateZone();
    this.interactions.update(this.player.x, this.player.y, !this.editMode);
    this.netSync.updateProximity(time, { x: this.player.x / TILE, y: this.player.y / TILE }, this.proximity);
    if (this.badgesDirty) this.refreshBadges();
  }

  // ---- remote players & chat --------------------------------------------------

  /** Adds a remote player or updates their existing entry. */
  upsertPlayer(p: PlayerState) {
    this.netSync.upsertPlayer(p);
  }

  /** Updates position and animation state for a remote player. */
  movePlayer(id: string, x: number, y: number, dir: number, moving: boolean, seated = false) {
    this.netSync.movePlayer(id, x, y, dir, moving, seated);
  }

  /** Removes a remote player and destroys their avatar. */
  removePlayer(id: string) {
    this.netSync.removePlayer(id);
  }

  /** Updates character appearance recipe for a remote player and their desk. */
  setPlayerCharacter(id: string, character: string) {
    this.netSync.setLook(id, character);
    this.ownerChanged(id, character);
  }

  /** Updates the active zone identifier for a remote player. */
  setPlayerZone(id: string, zone: string | null) {
    this.netSync.setZone(id, zone);
  }

  /** Updates the status emoji/bubble displayed above a remote player. */
  setPlayerStatus(id: string, status: string | null) {
    this.netSync.setStatus(id, status);
  }

  /** Sets voice activity (headset indicator and talking pulse) for a player. */
  setVoice(id: string, inCall: boolean, talking: boolean) {
    const avatar = id === this.opts.myId ? this.player : this.netSync.remotes.get(id)?.avatar;
    avatar?.setInCall(inCall, talking);
  }

  /** Displays a temporary speech bubble with chat text over a player's head. */
  showChat(userId: string, message: string) {
    const avatar = userId === this.opts.myId ? this.player : this.netSync.remotes.get(userId)?.avatar;
    avatar?.say(message);
  }

  // ---- local player -----------------------------------------------------------

  /** Updates the local player character appearance recipe and desk customization. */
  setOwnLook(character: string) {
    this.player.setLook(recipeOf(character));
    this.opts.character = character;
    this.ownerChanged(this.opts.myId, character);
  }

  /** Sets the status emoji/bubble displayed above the local player. */
  setOwnStatus(status: string | null) {
    this.opts.status = status;
    this.player.setStatus(status);
  }

  /** Returns current local player feet coordinates in pixels. */
  localPosition() {
    return { x: this.player.x, y: this.player.y };
  }

  /** Moves the local player instantly. Used by the dev/test hook (features/dev/devHooks.ts) and room-lock eviction. */
  teleportTo(x: number, y: number) {
    if (this.seating.isSeated) this.seating.standUp(true);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.reset(x, y);
    this.player.setPosition(x, y);
    this.player.animate(0, 0, 0);
    this.cameras.main.centerOn(x, y);
    this.netSync.sendPosition();
    this.lastZoneX = NaN;
    this.lastZoneY = NaN;
    this.updateZone();
  }

  // ---- desks & tasks ----------------------------------------------------------

  /** Updates desk assignments, name plates, interaction targets, and desk decorations. */
  setDesks(desks: DeskOwner[]) {
    this.desks = desks;
    this.plates.set(desks);
    this.interactions.setOwners(desks);
    this.furnitureSprites.redecorateDesks(this.desks, this.taskCounts);
  }

  /** Updates open task counts per user, updating paper stacks on their desks. */
  setTaskCounts(counts: ReadonlyMap<string, number>) {
    this.taskCounts = counts;
    this.furnitureSprites.redecorateDesks(this.desks, this.taskCounts);
  }

  /** Someone changed character: their avatar and their desk follow. */
  private ownerChanged(userId: string, character: string) {
    if (!this.desks.some((d) => d.userId === userId)) return;
    this.desks = this.desks.map((d) => (d.userId === userId ? { ...d, character } : d));
    this.furnitureSprites.redecorateDesks(this.desks, this.taskCounts);
  }

  // ---- meeting rooms & zones --------------------------------------------------

  /** Sets meeting room locks, blocking entry and evicting local player if currently inside. */
  setLockedRooms(roomIds: string[]): string | null {
    const insideRoomId = this.roomLocks.set(roomIds);
    if (!insideRoomId) return null;
    if (this.seating.isSeated) this.seating.standUp(true);
    const to = this.arrivalPoint(this.opts.layout);
    (this.player.body as Phaser.Physics.Arcade.Body).reset(to.x, to.y);
    this.cameras.main.centerOn(to.x, to.y);
    this.netSync.sendPosition();
    this.lastZoneX = NaN;
    this.lastZoneY = NaN;
    this.updateZone();
    return insideRoomId;
  }

  /** Updates meeting room booking badges displayed on walls. */
  setRoomBookings(bookings: RoomBooking[]) {
    this.badges.setBookings(bookings);
  }

  /** People per meeting room, from everyone's reported zone (and ours). */
  private refreshBadges() {
    this.badgesDirty = false;
    const counts = new Map<string, number>();
    const add = (zone: string | null | undefined) => zone && counts.set(zone, (counts.get(zone) ?? 0) + 1);
    for (const zone of this.netSync.remoteZones.values()) add(zone);
    add(this.currentZone?.id);
    this.badges.update(counts);
  }

  /** Emits zone:leave / zone:enter when the player's feet cross into a zone. */
  private updateZone() {
    if (this.player.x === this.lastZoneX && this.player.y === this.lastZoneY) return;
    this.lastZoneX = this.player.x;
    this.lastZoneY = this.player.y;
    const px = this.player.x / TILE;
    const py = this.player.y / TILE;
    let zone: Zone | null = null;
    for (const z of this.zones) {
      if (px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) {
        zone = z;
        break;
      }
    }
    if (zone?.id === this.currentZone?.id) return;
    if (this.currentZone) officeEvents.emit('zone:leave', toEvent(this.currentZone));
    if (zone) officeEvents.emit('zone:enter', toEvent(zone));
    this.currentZone = zone;
    this.opts.onZone(zone?.id ?? null);
    this.badgesDirty = true;
  }

  // ---- snapshot & minimap -----------------------------------------------------

  /** Captures current office positions, rooms, facing directions, and camera view for minimap. */
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
      others: [...this.netSync.remotes].map(([id, r]) => ({ id, ...at(r.avatar) })),
      view: { x: cam.x / TILE, y: cam.y / TILE, w: cam.width / TILE, h: cam.height / TILE },
    };
  }

  // ---- layout editing ---------------------------------------------------------

  /** Switches the scene to interactive layout editing mode. */
  startEditing(editor: LayoutEditor, onProblem: (text: string) => void) {
    if (this.editMode) return;
    if (this.seating.isSeated) this.seating.standUp(true);
    this.cameras.main.stopFollow();
    this.plates.setVisible(false);
    this.editMode = new EditMode(
      {
        scene: this,
        textureScale: textureScale(this.opts.dpr),
        sprites: this.furnitureSprites.sprites,
        depthOf: (item) => furnitureDepth(item, this.opts.layout.walls),
        shadowDepth: DEPTH.shadow,
      },
      editor,
      onProblem,
    );
  }

  // ---- camera view ------------------------------------------------------------

  /** Adjusts the camera zoom level by multiplying with the given factor. */
  zoomBy(factor: number) {
    this.viewControl.zoomBy(factor);
  }

  /** Resets camera zoom and view shift to default settings. */
  resetView() {
    this.viewControl.resetView();
  }

  /** Horizontally offsets the camera follow center by the specified CSS pixel amount. */
  setViewShift(cssPx: number) {
    this.viewControl.setViewShift(cssPx);
  }

  // ---- scene setup & physics --------------------------------------------------

  private setupScenery(worldW: number, worldH: number, solids: Phaser.Physics.Arcade.StaticGroup) {
    const { layout } = this.opts;
    this.obstacles = [];
    this.zones = deriveZones(layout);

    for (const wall of layout.walls) {
      const r = wallCollider(wall);
      this.addCollider(solids, r.x, r.y, r.w, r.h);
    }
    this.wallFaces = createWallFaces(this, layout, worldW, worldH, this.opts.dpr, this.opts.fontFamily);
    bakeStaticScenery(this, layout, this.wallFaces.leftover, this.opts.dpr, this.opts.fontFamily);
  }

  private setupFurniture(solids: Phaser.Physics.Arcade.StaticGroup) {
    const { layout } = this.opts;
    this.taskCounts = this.opts.taskCounts();
    this.furnitureSprites.redecorateDesks(this.opts.desks(), this.taskCounts);
    const scale = textureScale(this.opts.dpr);
    for (const item of layout.furniture) {
      this.furnitureSprites.addFurniture(item, scale);
      if (FURNITURE[item.kind].solid) {
        const b = pixels(itemBounds(item));
        this.addCollider(
          solids,
          b.x + FURNITURE_COLLIDER_INSET_PX,
          b.y + FURNITURE_COLLIDER_INSET_PX,
          b.w - 2 * FURNITURE_COLLIDER_INSET_PX,
          b.h - 2 * FURNITURE_COLLIDER_INSET_PX,
        );
      }
    }
    this.wallFaces.setFurnitureBehind(
      layout.furniture.filter((f) => FURNITURE[f.kind].solid && FURNITURE[f.kind].layer !== 'wall').map((f) => pixels(itemBounds(f))),
    );
  }

  private setupPlayer(worldW: number, worldH: number, solids: Phaser.Physics.Arcade.StaticGroup) {
    const { layout } = this.opts;
    this.roomLocks = new RoomLocks({
      scene: this,
      getLayout: () => this.opts.layout,
      getPlayerPos: () => ({ x: this.player?.x ?? 0, y: this.player?.y ?? 0 }),
    });

    const start =
      this.opts.startAt && this.isFree(this.opts.startAt.x, this.opts.startAt.y) ? this.opts.startAt : this.arrivalPoint(layout);
    this.player = new Avatar(
      this,
      start.x,
      start.y,
      recipeOf(this.opts.character),
      this.opts.name,
      this.opts.fontFamily,
      this.opts.dpr * TEXT_RESOLUTION_SCALE,
    );
    this.player.prebake();
    this.player.show();
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY_WIDTH_PX, PLAYER_BODY_HEIGHT_PX)
      .setOffset(PLAYER_BODY_OFFSET_X_PX, PLAYER_BODY_OFFSET_Y_PX)
      .setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.player, this.roomLocks.lockedSolids);
  }

  private setupSystems() {
    const { layout } = this.opts;
    const text = { fontFamily: this.opts.fontFamily, resolution: this.opts.dpr * TEXT_RESOLUTION_SCALE };
    this.roomAt = roomFinder(layout);
    this.proximity = new Proximity(this.roomAt);
    this.plates = new DeskPlates(this, layout, { ...text, myId: this.opts.myId, depth: DEPTH.sorted + DESK_PLATE_DEPTH_OFFSET });
    this.badges = new RoomBadges(this, layout, { ...text, depth: DEPTH.badges });
    this.interactions = new Interactions(this, layout, { ...text, myId: this.opts.myId, touch: this.opts.touch, depth: DEPTH.hints });

    this.netSync = new NetSync({
      scene: this,
      player: this.player,
      fontFamily: this.opts.fontFamily,
      dpr: this.opts.dpr,
      depthOf: (x, y, s) => peopleDepth(x, y, s, this.seating.seats, this.opts.layout.walls),
      onMove: this.opts.onMove,
      onBadgesDirty: () => {
        this.badgesDirty = true;
      },
    });

    this.seating = new Seating({
      player: this.player,
      layout: this.opts.layout,
      isFree: (x, y) => this.isFree(x, y),
      sendPosition: (moving) => this.netSync.sendPosition(moving),
      getOtherSeatedPositions: () => this.netSync.getSeatedPositions(),
    });

    this.setDesks(this.opts.desks());
    this.setRoomBookings(this.opts.bookings());
    this.setLockedRooms(this.opts.locked());
    this.player.setStatus(this.opts.status);

    for (const p of this.opts.players()) this.upsertPlayer(p);
    for (const [id, v] of this.opts.voice()) this.setVoice(id, v.inCall, v.talking);
  }

  private setupInput() {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== getKeybinds().interact || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!isTyping() && !this.editMode) this.interactions.trigger();
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.editMode && this.interactions.hits(p.worldX, p.worldY)) this.interactions.trigger();
    });
  }

  private setupView() {
    this.viewControl = new ViewControl({
      scene: this,
      getLayout: () => this.opts.layout,
      getDpr: () => this.opts.dpr,
    });
    this.viewControl.setup(this.player);
  }

  private setupEventHandlers() {
    const unsubLego = legoArt.subscribe((objectId) => {
      this.furnitureSprites.updateLegoBoard(objectId);
    });
    this.events.once('shutdown', () => {
      unsubLego();
      this.viewControl.destroy();
      this.wallFaces.destroy();
      this.netSync.destroy();
      this.furnitureSprites.destroy();
      this.editMode?.destroy();
      this.editMode = null;
      this.proximity.clear();
      this.interactions.destroy();
      this.opts.onZone(null);
      if (this.currentZone) officeEvents.emit('zone:leave', toEvent(this.currentZone));
    });
  }

  private addCollider(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number, h: number) {
    this.obstacles.push({ x, y, w, h });
    group.add(this.add.zone(x + w / 2, y + h / 2, w, h));
  }

  /** A free spot around the entrance, so people arriving together don't stand on each other. */
  private arrivalPoint(layout: OfficeLayout) {
    const spawn = { x: layout.spawn.x * TILE, y: layout.spawn.y * TILE };
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      // Close to the door: two people arriving together are within earshot (< 3 tiles apart).
      const distance = TILE * (0.5 + Math.random() * 0.9);
      const x = spawn.x + Math.cos(angle) * distance;
      const y = spawn.y + Math.sin(angle) * distance * 0.6;
      if (this.isFree(x, y) && y < layout.height * TILE - SPAWN_BOTTOM_MARGIN_PX) return { x, y };
    }
    return spawn;
  }

  /** True if the player's body fits at these feet coordinates (inside the office). */
  private isFree(x: number, y: number) {
    const { width, height } = this.opts.layout;
    if (x < TILE / 2 || y < TILE || x > (width - 0.5) * TILE || y > (height - 0.5) * TILE) return false;
    const body = playerBody(x, y);
    return !this.obstacles.some((o) => overlapsRect(body, o)) && !this.roomLocks.blocks(body);
  }
}

// (helpers)

function toEvent(zone: Zone) {
  return { type: zone.type, id: zone.id, name: zone.name };
}

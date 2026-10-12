/**
 * Main office scene lifecycle, coordinating rendering, physics, systems, and networking.
 * Serves as the primary Phaser scene hosting avatar gameplay and workspace interaction.
 */

import * as Phaser from 'phaser';
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
import { itemBounds } from '../layout/geometry';
import type { OfficeLayout } from '../layout/types';
import { Avatar, beginTextureBudget } from '../objects/Avatar';
import { DeskPlates, type DeskOwner } from '../objects/DeskPlates';
import { recipeOf } from '../art/recipe';
import { type RoomBooking, RoomBadges } from '../objects/RoomBadges';
import { Interactions } from '../systems/Interactions';
import { Proximity } from '../systems/Proximity';
import { roomFinder } from '../systems/rooms';
import { FURNITURE } from '../render/furniture';
import { textureScale } from '../render/sprites';
import type { WallFaces } from '../render/wallFaces';
import { wallCollider } from '../render/walls';
import { DEPTH, furnitureDepth, peopleDepth } from '../systems/Depth';
import { bakeStaticScenery, createWallFaces } from '../render/scenery';
import { ViewControl } from '../systems/ViewControl';
import { pixels, RoomLocks } from '../systems/RoomLocks';
import { NetSync, type OfficeSnapshot, type PlayerState } from '../systems/NetSync';
import { Seating } from '../systems/Seating';
import { FurnitureSprites } from '../systems/FurnitureSprites';
import { Zones } from '../systems/Zones';

/** Re-exported serialized network player state representation. */
export type { PlayerState };

/** Re-exported minimap snapshot representation. */
export type { OfficeSnapshot };

/** Inset in pixels applied to solid furniture colliders to allow smoother walking nearby. */
const FURNITURE_COLLIDER_INSET_PX = 2;

/** Double inset in pixels for total width and height reduction on solid colliders. */
const COLLIDER_TOTAL_INSET_PX = FURNITURE_COLLIDER_INSET_PX * 2;

/** Resolution scale multiplier for crisp high-DPI text badges and avatar labels. */
const TEXT_RESOLUTION_SCALE = 2;

/** Configuration options and event callbacks required to instantiate and run OfficeScene. */
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

/**
 * Core Phaser scene managing the interactive office environment, avatar physics,
 * scenery rendering, and delegated subsystem coordination:
 * - ViewControl: Camera tracking, zoom levels, and layout drawer view shift
 * - NetSync: Remote player lifecycle, positional lerping, minimap snapshots, and character appearances
 * - FurnitureSprites: Furniture rendering, dynamic overlays, and desk paper stacks
 * - DeskPlates: Desk occupant name tags and status bubbles
 * - RoomBadges: Meeting room booking status indicators and occupancy counters
 * - RoomLocks: Room access permissions, boundary enforcement, obstacle collisions, and spawn arrival points
 * - Zones: Zone boundary tracking and enter/leave event dispatching
 * - Seating: Chair proximity detection and sit/stand animations
 * - Interactions: Interactive elements (TV, whiteboard, foosball, desk prompt)
 * - Proximity: Voice proximity tracking and room audio containment
 * - EditMode: Interactive office layout editor
 */
export class OfficeScene extends Phaser.Scene {
  private opts!: OfficeSceneData;
  private player!: Avatar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private roomLocks!: RoomLocks;
  private zones!: Zones;
  private viewControl!: ViewControl;
  private seating!: Seating;
  private netSync!: NetSync;
  private furnitureSprites!: FurnitureSprites;
  private editMode: EditMode | null = null;
  private proximity!: Proximity;
  private interactions!: Interactions;
  private plates!: DeskPlates;
  private badges!: RoomBadges;
  private wallFaces!: WallFaces;
  private readonly crowd: Array<{ x: number; y: number }> = [];
  /** Virtual joystick (touch screens), -1..1 on each axis. */
  private joystick = { x: 0, y: 0 };
  private readonly moveVec = new Phaser.Math.Vector2();
  /** True while a full-screen game covers the office: the scene keeps ticking but ignores the keyboard. */
  private inputBlocked = false;
  /** Keyboard was taken by a panel or text field last frame. */
  private wasTyping = false;

  constructor() {
    super('office');
  }

  // ---- lifecycle --------------------------------------------------------------

  /** Initializes the scene state with incoming office data before creation. */
  init(data: OfficeSceneData) {
    this.opts = data;
    this.furnitureSprites = new FurnitureSprites({
      scene: this,
      getLayout: () => this.opts.layout,
      getDpr: () => this.opts.dpr,
      isEditing: () => Boolean(this.editMode),
    });
    this.editMode = null;
    this.joystick = { x: 0, y: 0 };
    this.inputBlocked = false;
  }

  /** Builds scenery, physics solids, player avatar, systems, view controls, and event listeners. */
  create() {
    const { layout } = this.opts;
    const worldW = layout.width * TILE;
    const worldH = layout.height * TILE;
    const solids = this.physics.add.staticGroup();

    this.roomLocks = new RoomLocks({
      scene: this,
      getLayout: () => this.opts.layout,
      getPlayerPos: () => ({ x: this.player?.x ?? 0, y: this.player?.y ?? 0 }),
    });

    this.setupScenery(worldW, worldH, solids);
    this.setupFurniture(solids);
    this.setupPlayer(worldW, worldH, solids);
    this.setupSystems();
    this.setupInput();
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
    // A panel took the keyboard: forget held keys, or a key released inside it (its keyup never
    // reaches Phaser) would stay "down" and keep the avatar walking once the panel closes.
    if (typing && !this.wasTyping) this.input.keyboard?.resetKeys();
    this.wasTyping = typing;
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
    this.zones.update(this.player.x, this.player.y);
    this.interactions.update(this.player.x, this.player.y, !this.editMode);
    this.netSync.updateProximity(time, { x: this.player.x / TILE, y: this.player.y / TILE }, this.proximity);
    this.badges.updateIfDirty(this.netSync.remoteZones.values(), this.zones.currentZoneId);
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
    this.furnitureSprites.setOwnerCharacter(id, character);
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
    this.netSync.setVoice(id, inCall, talking);
  }

  /** Displays a temporary speech bubble with chat text over a player's head. */
  showChat(userId: string, message: string) {
    this.netSync.showChat(userId, message);
  }

  // ---- local player -----------------------------------------------------------

  /** Updates the local player character appearance recipe and desk customization. */
  setOwnLook(character: string) {
    this.player.setLook(recipeOf(character));
    this.opts.character = character;
    this.furnitureSprites.setOwnerCharacter(this.opts.myId, character);
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
    this.zones.resetPosition();
    this.zones.update(x, y);
  }

  // ---- desks & tasks ----------------------------------------------------------

  /** Updates desk assignments, name plates, interaction targets, and desk decorations. */
  setDesks(desks: DeskOwner[]) {
    this.plates.set(desks);
    this.interactions.setOwners(desks);
    this.furnitureSprites.setDesks(desks);
  }

  /** Updates open task counts per user, updating paper stacks on their desks. */
  setTaskCounts(counts: ReadonlyMap<string, number>) {
    this.furnitureSprites.setTaskCounts(counts);
  }

  // ---- meeting rooms & zones --------------------------------------------------

  /** Sets meeting room locks, blocking entry and evicting local player if currently inside. */
  setLockedRooms(roomIds: string[]): string | null {
    const insideRoomId = this.roomLocks.set(roomIds);
    if (!insideRoomId) return null;
    if (this.seating.isSeated) this.seating.standUp(true);
    const to = this.roomLocks.arrivalPoint();
    (this.player.body as Phaser.Physics.Arcade.Body).reset(to.x, to.y);
    this.cameras.main.centerOn(to.x, to.y);
    this.netSync.sendPosition();
    this.zones.resetPosition();
    this.zones.update(to.x, to.y);
    return insideRoomId;
  }

  /** Updates meeting room booking badges displayed on walls. */
  setRoomBookings(bookings: RoomBooking[]) {
    this.badges.setBookings(bookings);
  }

  // ---- snapshot & minimap -----------------------------------------------------

  /** Captures current office positions, rooms, facing directions, and camera view for minimap. */
  snapshot(): OfficeSnapshot {
    return this.netSync.snapshot(this.cameras.main.worldView);
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
    for (const wall of layout.walls) {
      const r = wallCollider(wall);
      this.roomLocks.addSolidCollider(solids, r.x, r.y, r.w, r.h);
    }
    this.wallFaces = createWallFaces(this, layout, worldW, worldH, this.opts.dpr, this.opts.fontFamily);
    bakeStaticScenery(this, layout, this.wallFaces.leftover, this.opts.dpr, this.opts.fontFamily);
  }

  private setupFurniture(solids: Phaser.Physics.Arcade.StaticGroup) {
    const { layout } = this.opts;
    this.furnitureSprites.setTaskCounts(this.opts.taskCounts());
    this.furnitureSprites.setDesks(this.opts.desks());
    const scale = textureScale(this.opts.dpr);
    for (const item of layout.furniture) {
      this.furnitureSprites.addFurniture(item, scale);
      if (FURNITURE[item.kind].solid) {
        const b = pixels(itemBounds(item));
        this.roomLocks.addSolidCollider(
          solids,
          b.x + FURNITURE_COLLIDER_INSET_PX,
          b.y + FURNITURE_COLLIDER_INSET_PX,
          b.w - COLLIDER_TOTAL_INSET_PX,
          b.h - COLLIDER_TOTAL_INSET_PX,
        );
      }
    }
    this.wallFaces.setFurnitureBehind(
      layout.furniture.filter((f) => FURNITURE[f.kind].solid && FURNITURE[f.kind].layer !== 'wall').map((f) => pixels(itemBounds(f))),
    );
  }

  private setupPlayer(worldW: number, worldH: number, solids: Phaser.Physics.Arcade.StaticGroup) {
    const start =
      this.opts.startAt && this.roomLocks.isFree(this.opts.startAt.x, this.opts.startAt.y)
        ? this.opts.startAt
        : this.roomLocks.arrivalPoint();
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
    const roomAt = roomFinder(layout);
    this.proximity = new Proximity(roomAt);
    this.plates = new DeskPlates(this, layout, { ...text, myId: this.opts.myId, depth: DEPTH.sorted + DESK_PLATE_DEPTH_OFFSET });
    this.badges = new RoomBadges(this, layout, { ...text, depth: DEPTH.badges });
    this.interactions = new Interactions(this, layout, { ...text, myId: this.opts.myId, touch: this.opts.touch, depth: DEPTH.hints });

    this.zones = new Zones({
      layout,
      onZone: this.opts.onZone,
      onChanged: () => this.badges.markDirty(),
    });

    this.netSync = new NetSync({
      scene: this,
      player: this.player,
      myId: this.opts.myId,
      fontFamily: this.opts.fontFamily,
      dpr: this.opts.dpr,
      roomAt,
      depthOf: (x, y, s) => peopleDepth(x, y, s, this.seating.seats, this.opts.layout.walls),
      onMove: this.opts.onMove,
      onBadgesDirty: () => this.badges.markDirty(),
    });

    this.seating = new Seating({
      player: this.player,
      layout: this.opts.layout,
      isFree: (x, y) => this.roomLocks.isFree(x, y),
      sendPosition: (moving) => this.netSync.sendPosition(moving),
      getOtherSeatedPositions: () => this.netSync.getSeatedPositions(),
    });

    this.viewControl = new ViewControl({
      scene: this,
      getLayout: () => this.opts.layout,
      getDpr: () => this.opts.dpr,
    });
    this.viewControl.setup(this.player);

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
    const bind = (k: number) => kb.addKey(k, false);
    this.keys = {
      up: bind(K.UP), down: bind(K.DOWN), left: bind(K.LEFT), right: bind(K.RIGHT),
      w: bind(K.W), a: bind(K.A), s: bind(K.S), d: bind(K.D),
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

  private setupEventHandlers() {
    this.events.once('shutdown', () => {
      this.viewControl.destroy();
      this.wallFaces.destroy();
      this.netSync.destroy();
      this.furnitureSprites.destroy();
      this.editMode?.destroy();
      this.editMode = null;
      this.proximity.clear();
      this.interactions.destroy();
      this.zones.destroy();
    });
  }
}

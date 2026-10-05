import * as Phaser from 'phaser';
import { officeEvents } from '@/features/office/events';
import { TILE, WALK_SPEED } from '../constants';
import type { Furniture, OfficeLayout, Zone } from '../layout/types';
import { Avatar } from '../objects/Avatar';
import type { CharacterLook } from '../objects/looks';
import { rr, seededRandom } from '../render/draw';
import { drawFloor } from '../render/floors';
import { FURNITURE } from '../render/furniture';
import { drawWall, wallCollider } from '../render/walls';

export interface OfficeSceneData {
  layout: OfficeLayout;
  look: CharacterLook;
  name: string;
  fontFamily: string;
  /** Device pixel ratio: the canvas renders at this scale to stay sharp. */
  dpr: number;
}

// Drawing order of the scenery before it is baked: floor < rugs < shadows <
// walls and furniture (sorted by their bottom edge). Characters use their y.
const DEPTH = { floor: 0, rug: 1, shadow: 2 };

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.5;

export class OfficeScene extends Phaser.Scene {
  private opts!: OfficeSceneData;
  private player!: Avatar;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private currentZone: Zone | null = null;
  private userZoom = 1;

  constructor() {
    super('office');
  }

  init(data: OfficeSceneData) {
    this.opts = data;
  }

  create() {
    const { layout } = this.opts;
    const worldW = layout.width * TILE;
    const worldH = layout.height * TILE;
    const solids = this.physics.add.staticGroup();
    // Everything static is drawn into `scenery`, then baked into textures.
    const scenery: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];

    // Floors.
    const floor = this.add.graphics().setDepth(DEPTH.floor);
    scenery.push(floor);
    layout.rooms.forEach((room) => drawFloor(floor, room));

    // Soft shadows under solid furniture, all lit from the same direction.
    const shadows = this.add.graphics().setDepth(DEPTH.shadow);
    scenery.push(shadows);
    for (const item of layout.furniture) {
      const spec = FURNITURE[item.kind];
      if (!spec.solid) continue;
      const b = bounds(item);
      if (spec.round) {
        shadows.fillStyle(0x000000, 0.12);
        shadows.fillEllipse(b.x + b.w / 2 + 1, b.y + b.h / 2 + 4, b.w * 0.8, b.h * 0.75, 24);
      } else {
        rr(shadows, b.x + 1, b.y + 4, b.w + 2, b.h, 8, 0x000000, 0.1);
      }
    }

    // Furniture, each drawn around its centre and rotated.
    for (const item of layout.furniture) {
      const spec = FURNITURE[item.kind];
      const b = bounds(item);
      const g = this.add.graphics({ x: item.x * TILE, y: item.y * TILE });
      scenery.push(g);
      g.setRotation(Phaser.Math.DegToRad(item.rotation ?? 0));
      spec.draw(g, item.w * TILE, item.h * TILE, seededRandom(item.id), item.color);
      if (spec.layer === 'floor') g.setDepth(DEPTH.rug);
      else if (spec.layer === 'wall') g.setDepth(b.y + b.h + 40);
      else g.setDepth(b.y + b.h);
      if (spec.solid) addCollider(this, solids, b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    }

    // Walls.
    for (const wall of layout.walls) {
      const r = wallCollider(wall);
      // Vertical walls go under the furniture; horizontal ones sort by their line.
      const depth = wall.y1 === wall.y2 ? wall.y1 * TILE : DEPTH.shadow + 1;
      const g = this.add.graphics().setDepth(depth);
      drawWall(g, wall);
      scenery.push(g);
      addCollider(this, solids, r.x, r.y, r.w, r.h);
    }

    // Room names painted on the floor.
    for (const label of layout.labels) {
      const text = this.add
        .text(label.x * TILE, label.y * TILE, label.text, {
          fontFamily: this.opts.fontFamily,
          fontSize: '13px',
          fontStyle: '700',
          color: label.tone === 'dark' ? '#3f3f46' : '#ffffff',
        })
        .setOrigin(0.5)
        .setAlpha(label.tone === 'dark' ? 0.4 : 0.55)
        .setLetterSpacing(4)
        .setResolution(this.opts.dpr * 2)
        .setDepth(DEPTH.rug);
      scenery.push(text);
    }
    this.bake(scenery, worldW, worldH);

    // Player.
    this.player = new Avatar(
      this,
      layout.spawn.x * TILE,
      layout.spawn.y * TILE,
      this.opts.look,
      this.opts.name,
      this.opts.fontFamily,
      this.opts.dpr * 2,
    );
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 10).setOffset(-9, -10).setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.physics.add.collider(this.player, solids);

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

    // Camera follows the player smoothly.
    const cam = this.cameras.main;
    cam.setBackgroundColor('#e4e0da');
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setZoom(this.targetZoom());

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 1 / 1.12 : 1.12);
    });
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  update(_time: number, delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;
    if (!isTyping()) {
      const k = this.keys;
      vx = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
      vy = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
    }
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(WALK_SPEED);
    body.setVelocity(v.x, v.y);

    this.player.setDepth(this.player.y);
    this.player.animate(body.velocity.x, body.velocity.y, delta);
    this.updateZone();
  }

  /**
   * Draws the static office (floors, walls, furniture) once into a few large
   * textures, then throws the vector shapes away. Re-drawing hundreds of
   * shapes every frame is slow; drawing a few images is not. People always
   * stand in front of the furniture in this view, so the baked office can sit
   * under every character.
   */
  private bake(objects: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text>, worldW: number, worldH: number) {
    // Texture pixels per world pixel: sharp at the default zoom on retina screens.
    const scale = Math.min(3, this.opts.dpr * 1.5);
    const CHUNK = 512; // world pixels per texture side, keeps textures under GPU limits
    const PAD = 2; // chunks overlap slightly so no seams show between them
    const sorted = [...objects].sort((a, b) => a.depth - b.depth);

    for (let cy = 0; cy < worldH; cy += CHUNK) {
      for (let cx = 0; cx < worldW; cx += CHUNK) {
        const w = Math.min(CHUNK, worldW - cx) + PAD * 2;
        const h = Math.min(CHUNK, worldH - cy) + PAD * 2;
        const rt = this.add
          .renderTexture(cx - PAD, cy - PAD, Math.ceil(w * scale), Math.ceil(h * scale))
          .setOrigin(0)
          .setScale(1 / scale)
          .setDepth(DEPTH.floor);
        for (const o of sorted) {
          const { x, y, scaleX, scaleY } = o;
          o.setPosition((x - cx + PAD) * scale, (y - cy + PAD) * scale).setScale(scaleX * scale, scaleY * scale);
          rt.draw(o);
          o.setPosition(x, y).setScale(scaleX, scaleY);
        }
      }
    }
    objects.forEach((o) => o.destroy());
  }

  /** Multiply the user zoom (buttons, mouse wheel). */
  zoomBy(factor: number) {
    this.userZoom = Phaser.Math.Clamp(this.userZoom * factor, ZOOM_MIN, ZOOM_MAX);
    this.cameras.main.zoomTo(this.targetZoom(), 160, 'Sine.easeOut', true);
  }

  resetView() {
    this.userZoom = 1;
    this.cameras.main.zoomTo(this.targetZoom(), 220, 'Sine.easeOut', true);
  }

  /** Zoom that keeps characters a comfortable size on any screen. */
  private targetZoom() {
    const { dpr, layout } = this.opts;
    const cam = this.cameras.main;
    const cssWidth = cam.width / dpr;
    const base = Phaser.Math.Clamp(cssWidth / (26 * TILE), 0.75, 1.5);
    // Never zoom out further than the office itself (no empty space around it).
    const cover = Math.max(cam.width / (layout.width * TILE), cam.height / (layout.height * TILE));
    return Math.max(base * this.userZoom * dpr, cover);
  }

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.cameras.main.setZoom(this.targetZoom());
  }

  /** Emits zone:leave / zone:enter when the player's feet cross into a zone. */
  private updateZone() {
    const px = this.player.x / TILE;
    const py = this.player.y / TILE;
    const zone =
      this.opts.layout.zones.find((z) => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h) ?? null;
    if (zone === this.currentZone) return;
    if (this.currentZone) officeEvents.emit('zone:leave', toEvent(this.currentZone));
    if (zone) officeEvents.emit('zone:enter', toEvent(zone));
    this.currentZone = zone;
  }
}

/** Axis-aligned bounds of a (possibly rotated) item, in pixels. */
function bounds(item: Furniture) {
  const turned = item.rotation === 90 || item.rotation === 270;
  const w = (turned ? item.h : item.w) * TILE;
  const h = (turned ? item.w : item.h) * TILE;
  return { x: item.x * TILE - w / 2, y: item.y * TILE - h / 2, w, h };
}

function addCollider(scene: Phaser.Scene, group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number, h: number) {
  const zone = scene.add.zone(x + w / 2, y + h / 2, w, h);
  group.add(zone);
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

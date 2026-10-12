/**
 * Wall faces rendering and transparency management.
 * Slices solid walls into 1-tile columns baked to textures that smoothly fade
 * when occluding walking players or behind-wall furniture.
 */
import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Wall } from '../layout/types';
import { drawWall, isHorizontal, wallBase, wallBounds, wallHeight } from './walls';

const PAD = 2;
const PIECE_TILES = 8;
/** Scale snap steps: quarter steps keep one-tile columns on integer texture pixels. */
const SCALE_SNAP_STEPS = 4;
/** How far from a person (px) a column starts to fade, and the alpha right behind them. */
const REACH = 58;
const FULL_FADE_DX = 18;
const FADE_ALPHA = 0.35;
const FURNITURE_ALPHA = 0.5;
const FADE_MS = 110;
const ALPHA_EPSILON = 0.01;
const WALL_BASE_TOLERANCE_PX = 40;
const FURNITURE_BEHIND_MARGIN_PX = 2;

// Room name label constants
const LABEL_CULL_MARGIN_PX = 90;
const LABEL_ALPHA = 0.6;
const LABEL_LETTER_SPACING = 4;
const LABEL_CHAR_WIDTH_PX = 18;
const LABEL_PADDING_PX = 12;
const WALL_ALIGN_EPSILON = 0.01;
const AVOID_MARGIN_TILES = 0.2;

/** A room name, shown on the wall face above the room. Tile units. */
interface FaceLabel {
  text: string;
  /** Floor spot used when there is no wall to hang it on. */
  x: number;
  y: number;
  /** Room span and top edge. */
  x0: number;
  x1: number;
  top: number;
  tone: 'dark' | 'light';
}

interface Column {
  image: Phaser.GameObjects.Image;
  x0: number;
  x1: number;
  baseAlpha: number;
  alpha: number;
  target: number;
}

interface FadeWall {
  x0: number;
  x1: number;
  base: number;
  top: number;
  columns: Column[];
}

interface Person {
  x: number;
  y: number;
}

let uid = 0;

/**
 * Manages baked textures for vertical wall faces and room signs, cutting solid horizontal
 * walls into 1-tile columns that smoothly fade when players or furniture stand behind them.
 */
export class WallFaces {
  /** Labels that found no wall to hang on: the scene paints them on the floor. */
  readonly leftover: FaceLabel[] = [];
  private readonly scale: number;
  private readonly keys: string[] = [];
  private readonly fadeWalls: FadeWall[] = [];
  private readonly active = new Set<Column>();

  /** Creates baked wall face textures, attaches room signs, and initializes fade columns. */
  constructor(
    private readonly scene: Phaser.Scene,
    walls: Wall[],
    o: {
      scale: number;
      depthOf: (base: number) => number;
      labels: FaceLabel[];
      /** Tile x-ranges taken by boards and screens hung on the faces: names go beside them. */
      avoid: Array<{ x0: number; x1: number }>;
      fontFamily: string;
      resolution: number;
    },
  ) {
    // Quarter steps keep the one-tile columns on whole texture pixels.
    this.scale = Math.max(1, Math.round(o.scale * SCALE_SNAP_STEPS) / SCALE_SNAP_STEPS);
    const hung = new Map<Wall, Array<{ text: string; x: number; tone: 'dark' | 'light' }>>();
    for (const label of o.labels) {
      const spot = faceFor(walls, label, o.avoid);
      if (!spot) {
        this.leftover.push(label);
        continue;
      }
      const list = hung.get(spot.wall) ?? [];
      list.push({ text: label.text, x: spot.x, tone: label.tone });
      hung.set(spot.wall, list);
    }
    for (const wall of walls) this.build(wall, hung.get(wall) ?? [], o);
  }

  private drawPieceLabels(
    texture: Phaser.Textures.DynamicTexture,
    labels: Array<{ text: string; x: number; tone: 'dark' | 'light' }>,
    wx: number,
    pw: number,
    by: number,
    base: number,
    height: number,
    s: number,
    o: { fontFamily: string; resolution: number },
  ) {
    for (const label of labels) {
      const lx = label.x * TILE;
      if (Math.abs(lx - (wx + pw / 2)) > pw / 2 + LABEL_CULL_MARGIN_PX) continue;
      const text = this.scene.add
        .text(0, 0, label.text, {
          fontFamily: o.fontFamily,
          fontSize: '14px',
          fontStyle: '700',
          color: label.tone === 'dark' ? '#3f3f46' : '#52525b',
        })
        .setOrigin(0.5)
        .setAlpha(LABEL_ALPHA)
        .setLetterSpacing(LABEL_LETTER_SPACING)
        .setResolution(o.resolution)
        .setScale(s)
        .setPosition((lx - wx + PAD) * s, (base - height * 0.5 - by + PAD) * s);
      texture.draw(text);
      text.destroy();
    }
  }

  private bakePieceTexture(
    key: string,
    wall: Wall,
    labels: Array<{ text: string; x: number; tone: 'dark' | 'light' }>,
    wx: number,
    pw: number,
    b: { x: number; y: number; w: number; h: number },
    base: number,
    height: number,
    th: number,
    s: number,
    o: { fontFamily: string; resolution: number },
  ): Phaser.Textures.DynamicTexture {
    const texture = this.scene.textures.addDynamicTexture(key, Math.ceil((pw + PAD * 2) * s), th)!;
    const g = this.scene.make.graphics({}, false);
    drawWall(g, wall);
    g.setScale(s).setPosition((PAD - wx) * s, (PAD - b.y) * s);
    texture.draw(g);
    g.destroy();
    this.drawPieceLabels(texture, labels, wx, pw, b.y, base, height, s, o);
    return texture;
  }

  private addFadingColumns(
    fadeWall: FadeWall,
    texture: Phaser.Textures.DynamicTexture,
    key: string,
    wx: number,
    by: number,
    pw: number,
    th: number,
    depth: number,
    s: number,
  ) {
    for (let i = 0; i * TILE < pw; i++) {
      const cw = Math.min(TILE, pw - i * TILE);
      const frame = `c${i}`;
      texture.add(frame, 0, (PAD + i * TILE) * s, 0, cw * s, th);
      const image = this.scene.add
        .image(wx + i * TILE, by - PAD, key, frame)
        .setOrigin(0)
        .setScale(1 / s)
        .setDepth(depth);
      fadeWall.columns.push({ image, x0: wx + i * TILE, x1: wx + i * TILE + cw, baseAlpha: 1, alpha: 1, target: 1 });
    }
  }

  private build(
    wall: Wall,
    labels: Array<{ text: string; x: number; tone: 'dark' | 'light' }>,
    o: { depthOf: (base: number) => number; fontFamily: string; resolution: number },
  ) {
    const s = this.scale;
    const b = wallBounds(wall);
    const height = wallHeight(wall);
    const base = wallBase(wall);
    const depth = o.depthOf(base);
    const fade = isHorizontal(wall) && wall.kind === 'solid' && height > 0;
    const fadeWall: FadeWall = { x0: b.x, x1: b.x + b.w, base, top: b.y, columns: [] };
    const th = Math.ceil((b.h + PAD * 2) * s);

    for (let px = 0; px < b.w; px += PIECE_TILES * TILE) {
      const pw = Math.min(PIECE_TILES * TILE, b.w - px);
      const wx = b.x + px;
      const key = `wallface:${uid++}`;
      this.keys.push(key);
      const texture = this.bakePieceTexture(key, wall, labels, wx, pw, b, base, height, th, s, o);

      if (!fade) {
        this.scene.add
          .image(wx - PAD, b.y - PAD, key)
          .setOrigin(0)
          .setScale(1 / s)
          .setDepth(depth);
      } else {
        this.addFadingColumns(fadeWall, texture, key, wx, b.y, pw, th, depth, s);
      }
    }
    if (fade) this.fadeWalls.push(fadeWall);
  }

  /** Faces hide what stands right behind them: keep that furniture visible through a lighter face. */
  setFurnitureBehind(rects: Array<{ x: number; y: number; w: number; h: number }>) {
    for (const wall of this.fadeWalls) {
      for (const c of wall.columns) {
        const hidden = rects.some((r) => {
          const bottom = r.y + r.h;
          return bottom <= wall.base - FURNITURE_BEHIND_MARGIN_PX && bottom > wall.top && r.x < c.x1 && c.x0 < r.x + r.w;
        });
        c.baseAlpha = hidden ? FURNITURE_ALPHA : 1;
        c.alpha = c.target = c.baseAlpha;
        c.image.setAlpha(c.alpha);
      }
    }
  }

  /** Fades the columns that have someone behind them. People are feet positions in pixels. */
  update(delta: number, people: Iterable<Person>) {
    for (const c of this.active) c.target = c.baseAlpha;
    for (const p of people) {
      for (const wall of this.fadeWalls) {
        if (p.y >= wall.base || p.y <= wall.top || p.x < wall.x0 - REACH || p.x > wall.x1 + REACH) continue;
        const first = Math.max(0, Math.floor((p.x - REACH - wall.x0) / TILE));
        const last = Math.min(wall.columns.length - 1, Math.floor((p.x + REACH - wall.x0) / TILE));
        for (let i = first; i <= last; i++) {
          const c = wall.columns[i];
          const dx = Math.abs((c.x0 + c.x1) / 2 - p.x);
          const k = Math.min(1, Math.max(0, 1 - (dx - FULL_FADE_DX) / (REACH - FULL_FADE_DX)));
          const target = c.baseAlpha - (c.baseAlpha - FADE_ALPHA) * k;
          if (!this.active.has(c)) {
            this.active.add(c);
            c.target = c.baseAlpha;
          }
          if (target < c.target) c.target = target;
        }
      }
    }
    const step = Math.min(1, delta / FADE_MS);
    for (const c of this.active) {
      c.alpha += (c.target - c.alpha) * step;
      if (Math.abs(c.alpha - c.target) < ALPHA_EPSILON) c.alpha = c.target;
      c.image.setAlpha(c.alpha);
      if (c.alpha === c.baseAlpha && c.target === c.baseAlpha) this.active.delete(c);
    }
  }

  /** Lowest alpha over the face behind pixels [xa, xb] at base line y (for things hung on that face). */
  alphaFor(xa: number, xb: number, y: number) {
    let alpha = 1;
    for (const wall of this.fadeWalls) {
      if (Math.abs(wall.base - y) > WALL_BASE_TOLERANCE_PX) continue;
      for (const c of wall.columns) if (c.x0 < xb && xa < c.x1 && c.alpha < alpha) alpha = c.alpha;
    }
    return alpha;
  }

  /** Destroys cached dynamic textures and clears wall face state. */
  destroy() {
    for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.keys.length = 0;
    this.fadeWalls.length = 0;
    this.active.clear();
  }
}

/** The solid wall face above a room's top edge with room for its name, and where on it to hang the name (tiles). */
function faceFor(walls: Wall[], label: FaceLabel, avoid: Array<{ x0: number; x1: number }>) {
  const need = (label.text.length * LABEL_CHAR_WIDTH_PX + LABEL_PADDING_PX) / TILE;
  const half = need / 2;
  let best: { wall: Wall; x: number; distance: number } | null = null;
  for (const wall of walls) {
    if (!isHorizontal(wall) || wall.kind !== 'solid' || wallHeight(wall) === 0 || Math.abs(wall.y1 - label.top) > WALL_ALIGN_EPSILON) continue;
    const a = Math.max(Math.min(wall.x1, wall.x2), label.x0);
    const z = Math.min(Math.max(wall.x1, wall.x2), label.x1);
    if (z - a < need) continue;
    // Centred on the room if free, else beside the boards and screens hanging there.
    const spots = [label.x, (a + z) / 2, ...avoid.flatMap((r) => [r.x0 - half - AVOID_MARGIN_TILES, r.x1 + half + AVOID_MARGIN_TILES])];
    for (const x of spots) {
      if (x - half < a || x + half > z || avoid.some((r) => x + half > r.x0 && x - half < r.x1)) continue;
      const distance = Math.abs(x - label.x);
      if (!best || distance < best.distance) best = { wall, x, distance };
    }
  }
  return best;
}

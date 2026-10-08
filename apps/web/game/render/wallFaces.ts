import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import type { Wall } from '../layout/types';
import { drawWall, isHorizontal, wallBase, wallBounds, wallHeight } from './walls';

// Wall faces are baked once into small textures and shown as images, one per
// depth-sorted wall (so people walk in front of and behind them). Tall solid
// faces are cut into one-tile columns: a column fades when someone stands
// behind it, which costs nothing per frame beyond changing an alpha.

const PAD = 2;
const PIECE_TILES = 8;
/** How far from a person (px) a column starts to fade, and the alpha right behind them. */
const REACH = 58;
const FULL_FADE_DX = 18;
const FADE_ALPHA = 0.35;
const FURNITURE_ALPHA = 0.5;
const FADE_MS = 110;

/** A room name, shown on the wall face above the room. Tile units. */
export interface FaceLabel {
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

export class WallFaces {
  /** Labels that found no wall to hang on: the scene paints them on the floor. */
  readonly leftover: FaceLabel[] = [];
  private readonly scale: number;
  private readonly keys: string[] = [];
  private readonly fadeWalls: FadeWall[] = [];
  private readonly active = new Set<Column>();

  constructor(
    private readonly scene: Phaser.Scene,
    walls: Wall[],
    o: { scale: number; depthOf: (base: number) => number; labels: FaceLabel[]; fontFamily: string; resolution: number },
  ) {
    // Quarter steps keep the one-tile columns on whole texture pixels.
    this.scale = Math.max(1, Math.round(o.scale * 4) / 4);
    const hung = new Map<Wall, Array<{ text: string; x: number; tone: 'dark' | 'light' }>>();
    for (const label of o.labels) {
      const spot = faceFor(walls, label);
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
      const texture = this.scene.textures.addDynamicTexture(key, Math.ceil((pw + PAD * 2) * s), th)!;

      const g = this.scene.make.graphics({}, false);
      drawWall(g, wall);
      g.setScale(s).setPosition((PAD - wx) * s, (PAD - b.y) * s);
      texture.draw(g);
      g.destroy();

      for (const label of labels) {
        const lx = label.x * TILE;
        if (Math.abs(lx - (wx + pw / 2)) > pw / 2 + 90) continue;
        const text = this.scene.add
          .text(0, 0, label.text, {
            fontFamily: o.fontFamily,
            fontSize: '14px',
            fontStyle: '700',
            color: label.tone === 'dark' ? '#3f3f46' : '#52525b',
          })
          .setOrigin(0.5)
          .setAlpha(0.6)
          .setLetterSpacing(4)
          .setResolution(o.resolution)
          .setScale(s)
          .setPosition((lx - wx + PAD) * s, (base - height * 0.5 - b.y + PAD) * s);
        texture.draw(text);
        text.destroy();
      }

      if (!fade) {
        this.scene.add
          .image(wx - PAD, b.y - PAD, key)
          .setOrigin(0)
          .setScale(1 / s)
          .setDepth(depth);
        continue;
      }
      for (let i = 0; i * TILE < pw; i++) {
        const cw = Math.min(TILE, pw - i * TILE);
        const frame = `c${i}`;
        texture.add(frame, 0, (PAD + i * TILE) * s, 0, cw * s, th);
        const image = this.scene.add
          .image(wx + i * TILE, b.y - PAD, key, frame)
          .setOrigin(0)
          .setScale(1 / s)
          .setDepth(depth);
        fadeWall.columns.push({ image, x0: wx + i * TILE, x1: wx + i * TILE + cw, baseAlpha: 1, alpha: 1, target: 1 });
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
          return bottom <= wall.base - 2 && bottom > wall.top && r.x < c.x1 && c.x0 < r.x + r.w;
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
      if (Math.abs(c.alpha - c.target) < 0.01) c.alpha = c.target;
      c.image.setAlpha(c.alpha);
      if (c.alpha === c.baseAlpha && c.target === c.baseAlpha) this.active.delete(c);
    }
  }

  /** Lowest alpha over the face behind pixels [xa, xb] at base line y (for things hung on that face). */
  alphaFor(xa: number, xb: number, y: number) {
    let alpha = 1;
    for (const wall of this.fadeWalls) {
      if (Math.abs(wall.base - y) > 40) continue;
      for (const c of wall.columns) if (c.x0 < xb && xa < c.x1 && c.alpha < alpha) alpha = c.alpha;
    }
    return alpha;
  }

  destroy() {
    for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    this.keys.length = 0;
    this.fadeWalls.length = 0;
    this.active.clear();
  }
}

/** The solid wall face above a room's top edge with room for its name, and where on it to hang the name (tiles). */
function faceFor(walls: Wall[], label: FaceLabel) {
  const need = (label.text.length * 18 + 12) / TILE;
  let best: { wall: Wall; x: number; room: number } | null = null;
  for (const wall of walls) {
    if (!isHorizontal(wall) || wall.kind !== 'solid' || wallHeight(wall) === 0 || Math.abs(wall.y1 - label.top) > 0.01) continue;
    const a = Math.max(Math.min(wall.x1, wall.x2), label.x0);
    const z = Math.min(Math.max(wall.x1, wall.x2), label.x1);
    if (z - a >= need && (!best || z - a > best.room)) best = { wall, x: (a + z) / 2, room: z - a };
  }
  return best;
}

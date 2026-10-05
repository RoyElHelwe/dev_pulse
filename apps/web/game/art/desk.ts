import { pick, type Random, seededRandom } from '../render/draw';
import { drawCharacter } from './character';
import { type Hex, oklch, type Ramp } from './color';
import { CLOTH, GLOW, PAPER, PLANT, type Swatch, STICKY, TECH, WOOD } from './palette';
import type { Pen } from './pen';
import type { Recipe, Vibe } from './recipe';

// A desk decorates itself around its owner. It has a few anchor slots
// (monitor at the back, two back corners, two front corners, keyboard in the
// middle); the owner's "vibe" decides which props are likely in each slot, and
// their outfit colours tint the mug, the plant pot, the headphones... A free
// desk stays bare and switched off, so free seats are easy to spot.
// Seen from above, centred on (0, 0): the back (-y) holds the screens, the
// person sits at the front (+y).

export interface DeskOptions {
  /** Desk id: the same desk always gets the same things. */
  seed: string;
  /** Who sits here (null or missing: a free desk). */
  owner?: Recipe | null;
  /** 0 = fresh in the morning … 1 = end of the day (notes, papers, empty mugs). */
  wear?: number;
  /** The owner wears their headphones (in a call), so they're not on the desk. */
  headsetOn?: boolean;
  /** Clock in ms for steam, flames and LEDs; leave out for a still picture. */
  time?: number;
}

/** A light the desk gives off (monitors, lamp, candle), in desk coordinates. */
export interface DeskLight {
  x: number;
  y: number;
  radius: number;
  color: Hex;
  strength: number;
}

type Slot = 'backL' | 'backR' | 'frontL' | 'frontR';
type PropKind =
  | 'empty' | 'succulent' | 'pothos' | 'cactus' | 'lamp' | 'photo' | 'candle' | 'speaker' | 'can'
  | 'figurine' | 'books' | 'notebook' | 'headphones' | 'tablet' | 'sketchbook' | 'pencils' | 'cookies' | 'mug';

const POOLS: Record<Vibe, { back: [PropKind, number][]; front: [PropKind, number][]; screens: [Screens, number][]; wood: (keyof typeof WOOD)[]; mess: number }> = {
  minimal: {
    back: [['succulent', 3], ['empty', 4], ['speaker', 1]],
    front: [['mug', 4], ['notebook', 2], ['empty', 3]],
    screens: [['laptop', 3], ['single', 3]],
    wood: ['white', 'maple'],
    mess: 1,
  },
  cozy: {
    back: [['pothos', 4], ['lamp', 3], ['photo', 2], ['candle', 2]],
    front: [['mug', 5], ['cookies', 2], ['notebook', 1]],
    screens: [['single', 3], ['laptop', 2]],
    wood: ['oak', 'walnut'],
    mess: 3,
  },
  gamer: {
    back: [['figurine', 3], ['speaker', 2], ['can', 2]],
    front: [['headphones', 4], ['can', 3], ['mug', 2]],
    screens: [['dual', 3], ['ultrawide', 3]],
    wood: ['black'],
    mess: 4,
  },
  artist: {
    back: [['cactus', 3], ['pencils', 3], ['photo', 1]],
    front: [['tablet', 4], ['sketchbook', 3], ['mug', 2]],
    screens: [['single', 3], ['laptop', 1]],
    wood: ['maple', 'white'],
    mess: 6,
  },
  scholar: {
    back: [['books', 5], ['lamp', 3], ['succulent', 1]],
    front: [['notebook', 3], ['mug', 4], ['books', 2]],
    screens: [['single', 4], ['dual', 1]],
    wood: ['walnut', 'oak'],
    mess: 4,
  },
};

type Screens = 'single' | 'dual' | 'ultrawide' | 'laptop';

function weighted<T>(random: Random, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = random() * total;
  for (const [v, w] of entries) if ((roll -= w) < 0) return v;
  return entries[0][0];
}

const PI = Math.PI;

/** Draws the desk and everything on it; returns the lights it gives off. */
export function drawDesk(pen: Pen, w: number, h: number, options: DeskOptions): DeskLight[] {
  const random = seededRandom(`desk:${options.seed}`);
  const owner = options.owner ?? null;
  const vibe = owner?.vibe ?? 'minimal';
  const pool = POOLS[vibe];
  const time = options.time ?? 0;
  const lights: DeskLight[] = [];
  const x0 = -w / 2;
  const y0 = -h / 2;

  // Owner colours: the mug in their shirt colour, the pot in their trim...
  const accent: Ramp = owner ? CLOTH[owner.topColor].ramp : TECH.silver.ramp;
  const second: Ramp = owner ? CLOTH[owner.trimColor].ramp : TECH.white.ramp;

  // 1. The top.
  const wood: Swatch = owner ? WOOD[pick(random, pool.wood)] : WOOD.maple;
  const k = wood.ramp;
  pen.rect(x0, y0, w, h, 5, k.shadow);
  pen.rect(x0, y0, w - 1.5, h - 2, 5, k.base);
  pen.rect(x0 + 4, y0 + h - 4, w - 9, 1.4, 0.7, k.light, 0.8);
  if (wood === WOOD.oak || wood === WOOD.walnut) {
    for (let i = 0; i < 5; i++) {
      const gy = y0 + 6 + random() * (h - 12);
      const gx = x0 + 4 + random() * w * 0.5;
      pen.line(gx, gy, gx + w * (0.2 + random() * 0.3), gy + (random() - 0.5), 0.6, k.deep, 0.18);
    }
  }
  if (owner && (vibe === 'gamer' || vibe === 'artist')) {
    pen.rect(-w * 0.3, y0 + h * 0.45, w * 0.6, h * 0.42, 3, vibe === 'gamer' ? TECH.body.ramp.deep : accent.deep, 0.85);
  }

  // 2. Screens on the back edge (switched off on a free desk).
  const screens: Screens = owner ? weighted(random, pool.screens) : 'single';
  const on = !!owner;
  const screenAt = (sx: number, sw: number) => {
    pen.rect(sx - 5, y0 + 8, 10, 5, 2, TECH.silver.ramp.shadow);
    pen.rect(sx - sw / 2, y0 + 3.5, sw, 5.5, 2.5, TECH.body.ramp.deep);
    pen.rect(sx - sw / 2 + 1, y0 + 3.8, sw - 2, 1.4, 0.7, TECH.body.ramp.light, 0.8);
    if (on) {
      pen.rect(sx - sw / 2 + 1, y0 + 8.4, sw - 2, 1, 0.5, GLOW.screen, 0.9);
      lights.push({ x: sx, y: y0 + 14, radius: sw * 0.9, color: GLOW.screen, strength: 0.55 });
    }
  };
  if (screens === 'single') screenAt(0, 40);
  if (screens === 'dual') {
    screenAt(-w * 0.17, 30);
    screenAt(w * 0.17, 30);
  }
  if (screens === 'ultrawide') {
    pen.arc(0, y0 + 40, 36, PI * 1.33, PI * 1.67, 6, TECH.body.ramp.deep);
    pen.rect(-6, y0 + 8, 12, 5, 2, TECH.silver.ramp.shadow);
    if (on) lights.push({ x: 0, y: y0 + 14, radius: 52, color: GLOW.screen, strength: 0.6 });
  }
  if (vibe === 'gamer' && owner) {
    // LED strip behind the screens, in the owner's colour.
    const led = oklch(0.78, 0.17, (time / 30 + random() * 360) % 360);
    pen.rect(-w * 0.32, y0 + 1.2, w * 0.64, 1.6, 0.8, led, 0.9);
    lights.push({ x: 0, y: y0 + 2, radius: 46, color: led, strength: 0.45 });
  }

  // 3. Keyboard and mouse (or a laptop).
  const lefty = random() < 0.1;
  if (screens === 'laptop') {
    pen.rect(-14, y0 + 10, 28, 15, 2.5, TECH.silver.ramp.shadow);
    pen.rect(-14, y0 + 10, 27, 14, 2.5, TECH.silver.ramp.base);
    pen.rect(-12, y0 + 12.5, 23, 7, 1, TECH.silver.ramp.deep, 0.35);
    pen.rect(-5, y0 + 20.5, 10, 2.8, 1, TECH.silver.ramp.deep, 0.25);
    pen.rect(-14, y0 + 6, 28, 4.2, 1.8, TECH.body.ramp.base);
    if (on) lights.push({ x: 0, y: y0 + 14, radius: 30, color: GLOW.screen, strength: 0.45 });
  } else {
    const dark = vibe === 'gamer' && !!owner;
    const kb = dark ? TECH.body.ramp : TECH.white.ramp;
    pen.rect(-15, 2, 30, 9.5, 2, kb.shadow);
    pen.rect(-15, 2, 29.3, 8.8, 2, kb.base);
    for (let row = 0; row < 3; row++) {
      const color = dark ? oklch(0.75, 0.16, (row * 70 + time / 12) % 360) : kb.deep;
      pen.rect(-12.5, 4 + row * 2.2, 25, 1, 0.5, color, dark ? 0.9 : 0.35);
    }
    const mx = lefty ? -22 : 22;
    pen.rect(mx - 3, 3, 6, 9, 3, kb.shadow);
    pen.rect(mx - 3, 3, 5.4, 8.4, 3, kb.base);
  }

  // 4. Props in the corners.
  const slots: Record<Slot, { x: number; y: number }> = {
    backL: { x: x0 + 11, y: y0 + 11 },
    backR: { x: -x0 - 11, y: y0 + 11 },
    frontL: { x: x0 + 12, y: 9 },
    frontR: { x: -x0 - (lefty ? 30 : 12), y: 9 },
  };
  if (owner) {
    const used = new Set<PropKind>();
    for (const slot of ['backL', 'backR', 'frontL', 'frontR'] as Slot[]) {
      const list = slot.startsWith('back') ? pool.back : pool.front;
      let kind: PropKind = 'empty';
      for (let tries = 0; tries < 5; tries++) {
        kind = weighted(random, list);
        if (kind === 'headphones' && options.headsetOn) continue;
        if (kind === 'empty' || !used.has(kind)) break;
      }
      if (kind === 'headphones' && options.headsetOn) kind = 'empty';
      used.add(kind);
      prop(kind, slots[slot].x, slots[slot].y, slot);
    }
  } else {
    // A free desk: one plant, nothing else.
    if (random() < 0.5) prop('succulent', slots.backR.x, slots.backR.y, 'backR');
  }

  // 5. The day's clutter: always the same items in the same places, appearing one by one.
  if (owner) {
    const mess = seededRandom(`clutter:${options.seed}`);
    const items = Array.from({ length: 8 }, () => ({
      kind: weighted(mess, [['sticky', 4], ['paper', 3], ['ball', 1], ['mug', 1], ['pencil', 2]] as [string, number][]),
      x: (mess() - 0.5) * (w - 26),
      y: -4 + mess() * 18,
      angle: (mess() - 0.5) * 0.9,
      color: pick(mess, STICKY),
    }));
    const count = Math.round((options.wear ?? 0) * pool.mess * 1.4);
    items.slice(0, count).forEach((it, i) => {
      if (it.kind === 'sticky') {
        // Notes go on the monitor edge first, then on the desk.
        const onScreen = i % 2 === 0;
        const sx = onScreen ? -18 + i * 6 : it.x;
        const sy = onScreen ? y0 + 6.5 : it.y;
        pen.push(sx, sy, it.angle * 0.4);
        pen.rect(-2.2, -2.2, 4.4, 4.4, 0.4, it.color.ramp.shadow);
        pen.rect(-2.2, -2.2, 4.4, 3.8, 0.4, it.color.ramp.base);
        pen.pop();
      } else if (it.kind === 'paper' && Math.abs(it.x) > 14) {
        pen.push(it.x, it.y, it.angle);
        pen.rect(-5, -6.5, 10, 13, 0.6, PAPER.ramp.shadow, 0.9);
        pen.rect(-5, -6.5, 9.4, 12.4, 0.6, PAPER.ramp.base);
        for (let l = 0; l < 4; l++) pen.rect(-3.5, -4 + l * 2.6, 6 + (l % 2) * -2, 0.6, 0.3, TECH.silver.ramp.shadow, 0.8);
        pen.pop();
      } else if (it.kind === 'ball') {
        pen.circle(it.x, it.y, 2.6, PAPER.ramp.shadow);
        pen.circle(it.x - 0.4, it.y - 0.4, 2, PAPER.ramp.base);
      } else if (it.kind === 'mug' && Math.abs(it.x) > 18) {
        mug(it.x, it.y, second, false);
      } else if (it.kind === 'pencil') {
        pen.push(it.x, it.y, it.angle * 2);
        pen.rect(-5, -0.7, 10, 1.4, 0.7, CLOTH[2].ramp.base);
        pen.rect(4, -0.7, 1.5, 1.4, 0.4, PAPER.ramp.deep);
        pen.pop();
      }
    });
  }
  return lights;

  // ------------------------------------------------------------------ props
  function mug(x: number, y: number, ramp: Ramp, hot: boolean) {
    pen.circle(x, y, 4.6, ramp.shadow);
    pen.circle(x - 0.4, y - 0.4, 4, ramp.base);
    pen.circle(x - 0.2, y - 0.2, 2.9, vibe === 'cozy' ? oklch(0.62, 0.11, 60) : oklch(0.38, 0.05, 55));
    pen.rect(x + 3.6, y - 1.2, 2.6, 2.4, 1, ramp.shadow);
    if (hot && options.time !== undefined) {
      for (let i = 0; i < 2; i++) {
        const t = (time / 1600 + i * 0.5) % 1;
        pen.circle(x + Math.sin(t * 7 + i) * 1.5, y - 3 - t * 9, 1.4 + t, 0xffffff, 0.45 * (1 - t));
      }
    }
  }

  function pot(x: number, y: number, r: number) {
    pen.circle(x, y, r, second.shadow);
    pen.circle(x - 0.4, y - 0.4, r - 0.7, second.base);
    pen.circle(x, y, r - 1.6, oklch(0.36, 0.04, 55));
  }

  function prop(kind: PropKind, x: number, y: number, slot: Slot) {
    const leaf = PLANT.leaf.ramp;
    switch (kind) {
      case 'mug':
        mug(x, y, accent, true);
        break;
      case 'succulent':
        pot(x, y, 5);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * PI * 2 + 0.3;
          pen.circle(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.2, i % 2 ? leaf.base : leaf.shadow);
        }
        pen.circle(x - 0.3, y - 0.3, 1.6, leaf.light);
        break;
      case 'pothos': {
        pot(x, y, 5.5);
        // Vines trail towards the outer edge and spill over it.
        const out = slot.endsWith('L') ? -1 : 1;
        const p = PLANT.pothos.ramp;
        for (let v = 0; v < 3; v++) {
          let vx = x;
          let vy = y;
          for (let i = 0; i < 6; i++) {
            vx += out * (1.5 + random() * 2.2);
            vy += 1.2 + random() * 2.5 - v * 0.6;
            pen.circle(vx, vy, 2.1 - i * 0.15, i % 2 ? p.base : p.shadow);
          }
        }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          pen.circle(x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8, 2.6, i % 2 ? p.light : p.base);
        }
        break;
      }
      case 'cactus': {
        pot(x, y, 4.6);
        const c = PLANT.cactus.ramp;
        pen.circle(x, y, 3.2, c.shadow);
        pen.circle(x - 0.4, y - 0.4, 2.6, c.base);
        for (let i = 0; i < 4; i++) pen.line(x, y, x + Math.cos(i * PI / 2) * 2.6, y + Math.sin(i * PI / 2) * 2.6, 0.5, c.deep, 0.6);
        pen.circle(x + 0.8, y - 1.2, 1, oklch(0.75, 0.14, 0));
        break;
      }
      case 'lamp': {
        const out = slot.endsWith('L') ? 1 : -1;
        pen.circle(x, y + 2, 3.8, TECH.body.ramp.base);
        pen.line(x, y + 2, x + out * 7, y - 3, 1.3, TECH.body.ramp.shadow);
        pen.ellipse(x + out * 9, y - 3, 9, 6, accent.shadow);
        pen.ellipse(x + out * 8.6, y - 3.4, 7.6, 4.8, accent.base);
        lights.push({ x: x + out * 9, y: y - 1, radius: 44, color: GLOW.lamp, strength: 0.85 });
        break;
      }
      case 'photo':
        pen.push(x, y, -0.18);
        pen.rect(-5.5, -4.5, 11, 9, 1, second.deep);
        pen.rect(-4.3, -3.3, 8.6, 6.6, 0.5, oklch(0.85, 0.06, 230));
        pen.poly([-4.3, 3.3, -1, -0.5, 1.5, 1.6, 2.8, 0.2, 4.3, 3.3], oklch(0.6, 0.1, 150));
        pen.circle(2.4, -1.6, 1.1, oklch(0.9, 0.12, 90));
        pen.pop();
        break;
      case 'candle': {
        pen.circle(x, y, 3.8, oklch(0.9, 0.03, 85));
        pen.circle(x, y, 2.6, oklch(0.95, 0.02, 85));
        const flicker = options.time !== undefined ? 0.85 + Math.sin(time / 70) * 0.08 + Math.sin(time / 31) * 0.07 : 1;
        pen.circle(x, y - 0.4, 1.3 * flicker, GLOW.candle);
        lights.push({ x, y, radius: 30 * flicker, color: GLOW.candle, strength: 0.75 });
        break;
      }
      case 'speaker':
        pen.rect(x - 3.8, y - 4.8, 7.6, 9.6, 1.6, TECH.body.ramp.shadow);
        pen.rect(x - 3.8, y - 4.8, 7, 9, 1.6, TECH.body.ramp.base);
        pen.circle(x - 0.3, y + 0.8, 2.4, TECH.body.ramp.deep);
        pen.circle(x - 0.3, y - 3, 0.9, TECH.body.ramp.deep);
        break;
      case 'can':
        pen.circle(x, y, 3, accent.shadow);
        pen.circle(x - 0.3, y - 0.3, 2.5, accent.base);
        pen.ring(x, y, 2.1, 0.6, TECH.silver.ramp.base);
        break;
      case 'figurine':
        // A tiny version of the owner.
        pen.ellipse(x, y + 3, 9, 4, TECH.body.ramp.base);
        if (owner) {
          pen.push(x, y + 3, 0, 0.3, 0.3);
          drawCharacter(pen, owner, { dir: 'down' });
          pen.pop();
        }
        break;
      case 'books': {
        for (let i = 0; i < 3; i++) {
          const b = CLOTH[Math.floor(random() * CLOTH.length)].ramp;
          pen.push(x, y - i * 1.2, (random() - 0.5) * 0.5);
          pen.rect(-6, -4.5, 12, 9, 1, b.shadow);
          pen.rect(-6, -4.5, 11.4, 8.3, 1, b.base);
          pen.rect(-6, -4.5, 1.6, 9, 0.5, b.deep);
          pen.pop();
        }
        break;
      }
      case 'notebook':
        pen.push(x, y, 0.12);
        pen.rect(-6, -7.5, 12, 15, 1.2, accent.shadow);
        pen.rect(-6, -7.5, 11.4, 14.4, 1.2, accent.base);
        for (let i = 0; i < 6; i++) pen.circle(-5.4, -6 + i * 2.4, 0.55, TECH.silver.ramp.base);
        pen.line(-1, 6, 6, -3, 1, TECH.body.ramp.base);
        pen.pop();
        break;
      case 'headphones':
        pen.push(x, y, 0.4);
        pen.arc(0, 0, 6, PI * 1.05, PI * 1.95, 1.8, TECH.body.ramp.base);
        for (const s of [-1, 1]) {
          pen.circle(s * 6, 0.8, 3.2, TECH.body.ramp.shadow);
          pen.circle(s * 6 - 0.3, 0.5, 2.6, second.base);
        }
        pen.pop();
        break;
      case 'tablet':
        pen.push(x + 2, y, -0.1);
        pen.rect(-10, -7, 20, 14, 2, TECH.body.ramp.base);
        pen.rect(-8.6, -5.6, 17.2, 11.2, 1, on ? oklch(0.9, 0.03, 85) : TECH.body.ramp.deep);
        pen.line(-6, 3, -1, -2, 0.9, accent.base);
        pen.line(-1, -2, 3, 1, 0.9, second.base);
        pen.line(10.5, -5, 12, 6, 1, TECH.silver.ramp.base);
        pen.pop();
        break;
      case 'sketchbook':
        pen.push(x, y, -0.15);
        pen.rect(-7, -6, 14, 12, 0.8, PAPER.ramp.shadow);
        pen.rect(-7, -6, 13.4, 11.4, 0.8, PAPER.ramp.base);
        pen.circle(-1, -0.5, 3, accent.base, 0.5);
        pen.arc(1, 1, 3.5, PI, PI * 1.8, 0.8, TECH.body.ramp.base, 0.7);
        pen.pop();
        break;
      case 'pencils':
        pen.circle(x, y, 3.8, accent.shadow);
        pen.circle(x - 0.3, y - 0.3, 3.2, accent.base);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * PI * 2 + 0.4;
          pen.circle(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 0.9, CLOTH[(i * 4 + 1) % CLOTH.length].ramp.base);
        }
        break;
      case 'cookies':
        pen.circle(x, y, 5, PAPER.ramp.shadow);
        pen.circle(x - 0.4, y - 0.4, 4.4, PAPER.ramp.base);
        for (const [cx, cy] of [[-1.6, -0.6], [1.6, 1]]) {
          pen.circle(x + cx, y + cy, 2, oklch(0.68, 0.09, 65));
          pen.circle(x + cx + 0.4, y + cy - 0.3, 0.45, oklch(0.32, 0.04, 50));
        }
        break;
      case 'empty':
        break;
    }
  }
}

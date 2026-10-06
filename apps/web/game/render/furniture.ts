import type * as Phaser from 'phaser';
import type { FurnitureKind } from '../layout/types';
import { circle, pick, type Random, rr, rrStroke, shade } from './draw';

type G = Phaser.GameObjects.Graphics;

// Every drawing works in local pixels, centred on (0, 0), unrotated:
// "north" (-y) is the back of the item, "south" (+y) is where the person is.
type DrawFn = (g: G, w: number, h: number, random: Random, color?: number) => void;

interface FurnitureSpec {
  /** Blocks the player. */
  solid: boolean;
  /** Round items get a round shadow. */
  round?: boolean;
  /** 'floor' items (rugs) are drawn under everything; 'wall' items on the wall face. */
  layer?: 'floor' | 'wall';
  draw: DrawFn;
}

const WOOD_LIGHT = 0xf1ebe2;
const WOOD_WALNUT = 0x6e5241;
const METAL_DARK = 0x262a2e;
const BOOK_COLORS = [0xc0574a, 0x3f6e8c, 0xe3b55a, 0x4f7d5c, 0xd9d4cc, 0x2f3e4e, 0x8c6a9f];
const MUG_COLORS = [0xffffff, 0x2f3e4e, 0xd9734e, 0x6b9080];
const CARD_COLORS = [0xf4d35e, 0xee964b, 0x0ea5e9, 0x10b981, 0xf43f5e];

const desk: DrawFn = (g, w, h, random) => {
  const x = -w / 2;
  const y = -h / 2;
  rr(g, x, y, w, h, 5, WOOD_LIGHT);
  rrStroke(g, x + 0.5, y + 0.5, w - 1, h - 1, 5, 0xd8d0c4);
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(x + 4, y + h - 3, w - 8, 1.5);

  // Monitor(s) on the back edge, seen from above.
  const dual = random() > 0.55;
  const screens = dual ? [-w * 0.17, w * 0.17] : [0];
  for (const sx of screens) {
    rr(g, sx - 6, y + 8, 12, 5, 2, 0x9aa1a8); // stand
    rr(g, sx - (dual ? 15 : 22), y + 4, dual ? 30 : 44, 5, 2.5, 0x1b1e21); // screen
  }
  // Keyboard and mouse.
  rr(g, -15, 3, 30, 9, 2, 0xfbfbfb);
  rrStroke(g, -15, 3, 30, 9, 2, 0xd4d4d8);
  g.fillStyle(0xd4d4d8, 1);
  g.fillRect(-12, 6, 24, 1);
  g.fillRect(-12, 8.5, 24, 1);
  rr(g, 20, 4, 6, 9, 3, 0xf4f4f5);
  rrStroke(g, 20, 4, 6, 9, 3, 0xcfcfd4);
  // Coffee mug.
  circle(g, x + 12, 8, 4.5, pick(random, MUG_COLORS));
  circle(g, x + 12, 8, 3, 0x5b3d2a);
  // Sometimes a notebook.
  if (random() > 0.5) {
    rr(g, w / 2 - 17, y + h - 20, 14, 17, 2, pick(random, [0xe9d7b4, 0xc7d6e2, 0xe7c3c0]));
  }
};

const chair: DrawFn = (g, w, h) => {
  const s = Math.min(w, h);
  rr(g, -s / 2, -s / 2 + 1, s, s - 2, s * 0.32, 0x2b2f33);
  rr(g, -s / 2 + 3, -s / 2 + 3, s - 6, s - 8, s * 0.28, 0x3c4248);
  rr(g, -s / 2 - 1, s / 2 - 7, s + 2, 7, 3.5, 0x1d2023); // backrest
  rr(g, -s / 2 - 2, -s / 2 + 5, 3, s - 12, 1.5, 0x1d2023); // armrests
  rr(g, s / 2 - 1, -s / 2 + 5, 3, s - 12, 1.5, 0x1d2023);
};

const divider: DrawFn = (g, w, h) => {
  rr(g, -w / 2, -h / 2 - 1, w, h + 2, 2, 0xa9b4b0);
  g.fillStyle(0xffffff, 0.35);
  g.fillRect(-w / 2 + 2, -h / 2, w - 4, 1);
};

const meetingTable: DrawFn = (g, w, h, random) => {
  rr(g, -w / 2, -h / 2, w, h, h * 0.45, WOOD_WALNUT);
  rr(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, h * 0.42, shade(WOOD_WALNUT, 0.08));
  rr(g, -14, -4, 28, 8, 3, 0x2a2a2a); // power box
  // A few notebooks and a laptop around the table.
  for (const fx of [-0.3, 0.05, 0.32]) {
    if (random() > 0.4) {
      rr(g, w * fx - 7, h / 2 - 22, 14, 11, 2, pick(random, [0xd7dadf, 0xf3efe7, 0xc4ccd4]));
    }
  }
  circle(g, -w * 0.4, -h * 0.15, 3.5, 0xdbeef5);
  circle(g, w * 0.38, h * 0.1, 3.5, 0xdbeef5);
};

const tv: DrawFn = (g, w, h) => {
  rr(g, -w / 2, -h / 2, w, h, 2, 0x111417);
  g.fillStyle(0x3b4b58, 1);
  g.fillRect(-w / 2 + 3, -h / 2 + 2, w - 6, 1.5);
};

const board: DrawFn = (g, w, h, random) => {
  rr(g, -w / 2, -h / 2, w, h, 2, METAL_DARK);
  rr(g, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 1, 0xffffff);
  g.fillStyle(0xd0d5dd, 1);
  g.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, 2.5);

  const colW = (w - 2) / 3;
  g.fillStyle(0xe4e7ec, 1);
  g.fillRect(-w / 2 + 1 + colW, -h / 2 + 3.5, 1, h - 4.5);
  g.fillRect(-w / 2 + 1 + colW * 2, -h / 2 + 3.5, 1, h - 4.5);

  for (let col = 0; col < 3; col++) {
    const colLeft = -w / 2 + 1 + col * colW;
    const count = 1 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const cx = colLeft + 3 + i * 8;
      const cy = -h / 2 + 5 + (i % 2) * 2;
      rr(g, cx, cy, 6, 4, 1, pick(random, CARD_COLORS));
    }
  }
};

const seat = (cushions: number): DrawFn => (g, w, h, _random, color = 0x5f7a6b) => {
  const arm = Math.max(7, w * 0.12);
  const back = h * 0.34;
  rr(g, -w / 2, -h / 2, w, h, 9, shade(color, -0.12));
  // Seat cushions.
  const inner = w - arm * 2;
  const cw = inner / cushions;
  for (let i = 0; i < cushions; i++) {
    rr(g, -w / 2 + arm + i * cw + 1, -h / 2 + 3, cw - 2, h - back - 3, 6, color);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(-w / 2 + arm + i * cw + 5, -h / 2 + 6, cw - 10, 2);
  }
  // Backrest (south side) and armrests.
  rr(g, -w / 2, h / 2 - back, w, back, 8, shade(color, -0.2));
  rr(g, -w / 2, -h / 2, arm, h, 7, shade(color, -0.16));
  rr(g, w / 2 - arm, -h / 2, arm, h, 7, shade(color, -0.16));
  // A throw pillow leaning on the backrest.
  if (cushions > 1) rr(g, -w / 2 + arm + 4, h / 2 - back - 6, 14, 11, 4, 0xf0e6d6);
};

const coffeeTable: DrawFn = (g, w, h) => {
  rr(g, -w / 2, -h / 2, w, h, 6, 0xe7ddd0);
  rrStroke(g, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, 6, 0xcdbfae);
  rr(g, -w / 2 + 8, -6, 16, 12, 1.5, 0x3f6e8c); // books
  rr(g, -w / 2 + 10, -4, 14, 9, 1.5, 0xe3b55a);
  circle(g, w / 2 - 14, 0, 4.5, 0xffffff);
  circle(g, w / 2 - 14, 0, 3, 0x5b3d2a);
};

const rug: DrawFn = (g, w, h, _random, color = 0xd9cdbb) => {
  rr(g, -w / 2, -h / 2, w, h, 10, color);
  rrStroke(g, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 6, shade(color, 0.25), 2);
  rrStroke(g, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 4, shade(color, -0.08), 1);
};

const plant: DrawFn = (g, w, h, random) => {
  const s = Math.min(w, h);
  const pot = s * 0.3;
  circle(g, 0, 0, pot + 1, 0xcfc8be);
  circle(g, 0, 0, pot, 0xe4dfd7);
  circle(g, 0, 0, pot * 0.75, 0x5a4636);
  // Leaves radiating from the centre, each one rotated.
  const greens = [0x3f7d4e, 0x5a9a63, 0x2f6a3f, 0x6fae6a];
  const leaves = 8 + Math.floor(random() * 4);
  for (let i = 0; i < leaves; i++) {
    const angle = (i / leaves) * Math.PI * 2 + random() * 0.5;
    const len = s * (0.32 + random() * 0.16);
    g.save();
    g.translateCanvas(0, 0);
    g.rotateCanvas(angle);
    g.fillStyle(pick(random, greens), 1);
    g.fillEllipse(len * 0.55, 0, len, len * 0.42, 12);
    g.restore();
  }
  circle(g, 0, 0, s * 0.08, 0x4c8f57);
};

const bookshelf: DrawFn = (g, w, h, random) => {
  rr(g, -w / 2, -h / 2, w, h, 3, 0x8b6b4e);
  rr(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 2, 0x3e2f24);
  let x = -w / 2 + 4;
  while (x < w / 2 - 8) {
    const bw = 4 + random() * 5;
    const bh = (h - 8) * (0.55 + random() * 0.4);
    if (random() > 0.12) rr(g, x, -h / 2 + 4, bw - 1, bh, 1, pick(random, BOOK_COLORS));
    x += bw;
  }
};

const counter: DrawFn = (g, w, h) => {
  rr(g, -w / 2, -h / 2, w, h, 3, 0xf5f4f1);
  rrStroke(g, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, 3, 0xd9d4cc);
  g.fillStyle(0xe6e1d9, 1);
  g.fillRect(-w / 2, h / 2 - 3, w, 3);
  // Sink + tap.
  rr(g, -w * 0.25 - 17, -9, 34, 20, 5, 0xc9ced3);
  rr(g, -w * 0.25 - 14, -6, 28, 14, 4, 0xb3bac1);
  rr(g, -w * 0.25 - 1.5, -h / 2 + 2, 3, 9, 1.5, 0x8f979e);
  // Coffee machine and cups.
  rr(g, w * 0.18 - 12, -h / 2 + 3, 24, 18, 3, METAL_DARK);
  circle(g, w * 0.18, -h / 2 + 12, 3.5, 0x8a8f94);
  circle(g, w * 0.18 + 20, 2, 3.5, 0xffffff);
  circle(g, w * 0.18 + 29, 2, 3.5, 0xffffff);
  // Fruit bowl.
  circle(g, w * 0.4, 0, 9, 0xffffff);
  circle(g, w * 0.4 - 3, -2, 3.5, 0xf29c38);
  circle(g, w * 0.4 + 3, 1, 3.5, 0x9cc65a);
  circle(g, w * 0.4 - 1, 4, 3, 0xe24a3b);
};

const fridge: DrawFn = (g, w, h) => {
  rr(g, -w / 2, -h / 2, w, h, 4, 0xe2e6e9);
  rrStroke(g, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, 4, 0xbfc5ca);
  g.fillStyle(0xbfc5ca, 1);
  g.fillRect(-w / 2 + 2, h / 2 - 9, w - 4, 1);
  rr(g, -8, h / 2 - 6, 16, 3, 1.5, 0x9aa2a9);
};

const barTable: DrawFn = (g, w, h) => {
  rr(g, -w / 2, -h / 2, w, h, h * 0.45, 0xefe8de);
  rrStroke(g, -w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, h * 0.45, 0xcbbfb0);
  circle(g, -w * 0.25, 0, 3.5, 0xffffff);
  circle(g, w * 0.2, -2, 3.5, 0xd9734e);
};

const stool: DrawFn = (g, w) => {
  circle(g, 0, 0, w / 2, 0x33383d);
  circle(g, 0, 0, w / 2 - 3, 0xc9a27e);
};

const beanbag: DrawFn = (g, w, h, _random, color = 0x4f6d8f) => {
  g.fillStyle(shade(color, -0.15), 1);
  g.fillEllipse(0, 1, w, h, 24);
  g.fillStyle(color, 1);
  g.fillEllipse(0, -1, w - 6, h - 7, 24);
  g.fillStyle(0xffffff, 0.18);
  g.fillEllipse(-w * 0.12, -h * 0.15, w * 0.35, h * 0.22, 16);
};

const floorLamp: DrawFn = (g, w) => {
  circle(g, 0, 0, w * 0.7, 0xfff1cf, 0.22); // warm light on the floor
  circle(g, 0, 0, w * 0.32, 0xf3e7d3);
  circle(g, 0, 0, w * 0.32 - 3, 0xfaf3e6);
  circle(g, 0, 0, 2.5, 0x2b2b2b);
};

export const FURNITURE: Record<FurnitureKind, FurnitureSpec> = {
  desk: { solid: true, draw: desk },
  chair: { solid: false, draw: chair },
  divider: { solid: true, draw: divider },
  meetingTable: { solid: true, draw: meetingTable },
  tv: { solid: false, layer: 'wall', draw: tv },
  board: { solid: true, layer: 'wall', draw: board },
  sofa: { solid: true, draw: seat(3) },
  armchair: { solid: true, draw: seat(1) },
  coffeeTable: { solid: true, draw: coffeeTable },
  rug: { solid: false, layer: 'floor', draw: rug },
  plant: { solid: true, round: true, draw: plant },
  bookshelf: { solid: true, draw: bookshelf },
  counter: { solid: true, draw: counter },
  fridge: { solid: true, draw: fridge },
  barTable: { solid: true, draw: barTable },
  stool: { solid: false, draw: stool },
  beanbag: { solid: true, round: true, draw: beanbag },
  floorLamp: { solid: false, layer: 'floor', draw: floorLamp },
};

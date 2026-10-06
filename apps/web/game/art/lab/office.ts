import { TILE } from '../../constants';
import { itemBounds, numberedDesks, seatPoint } from '../../layout/derive';
import type { Furniture, OfficeLayout } from '../../layout/types';
import { seededRandom } from '../../render/draw';
import { drawFloor } from '../../render/floors';
import { FURNITURE } from '../../render/furniture';
import { drawWall, wallCollider } from '../../render/walls';
import { roomFinder } from '../../systems/rooms';
import { type Direction, drawCharacter, type Mood } from '../character';
import { css, type Hex, mix } from '../color';
import { type DeskLight, drawDesk } from '../desk';
import { GLOW } from '../palette';
import { canvasPen, type Pen } from '../pen';
import type { Recipe } from '../recipe';
import { CanvasGraphics } from './shim';

// A small simulation of a day at the office, drawn with the game's real
// scenery code and the new characters and desks: people arrive, work, take
// coffee, meet, chat by proximity, and go home; the light follows the clock.

/** Same as NEAR_RADIUS in systems/Proximity.ts (tiles). */
const NEAR = 3;
const CELL = 16;
const WALK = 92;
const PAD = 6;

type Activity = 'arriving' | 'desk' | 'coffee' | 'lounge' | 'visit' | 'meeting' | 'leaving' | 'away';

export interface Person {
  name: string;
  recipe: Recipe;
}

interface Agent extends Person {
  id: number;
  desk: Furniture | null;
  seat: { x: number; y: number; dir: Direction };
  x: number;
  y: number;
  dir: Direction;
  phase: number;
  path: { x: number; y: number }[];
  activity: Activity;
  /** Real ms when the current activity ends. */
  until: number;
  /** Where to face on arrival. */
  face: Direction;
  mugUntil: number;
  arrive: number;
  leave: number;
  present: boolean;
  wear: number;
  inCall: boolean;
  talking: boolean;
  /** Meeting room or colleague being visited. */
  with: number | null;
}

export interface OfficeOptions {
  /** Called when someone is clicked. */
  onPick?: (person: Person) => void;
}

// Ambient light through the day (hour → colour multiplied over the scene).
const SKY: [number, Hex][] = [
  [0, 0x262d52],
  [5, 0x30386a],
  [6.5, 0xe0a98f],
  [8, 0xfff6ec],
  [12, 0xffffff],
  [16.5, 0xfff4e4],
  [18.3, 0xf2b48a],
  [19.4, 0x8a7cb4],
  [20.6, 0x3a4276],
  [24, 0x262d52],
];

export function skyAt(hour: number): Hex {
  for (let i = 1; i < SKY.length; i++) {
    if (hour <= SKY[i][0]) {
      const [h0, c0] = SKY[i - 1];
      const [h1, c1] = SKY[i];
      return mix(c0, c1, (hour - h0) / (h1 - h0));
    }
  }
  return SKY[0][1];
}

const luminance = (c: Hex) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;

export class OfficeSim {
  hour = 10.5;
  showRadius = true;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pen: Pen;
  private readonly worldW: number;
  private readonly worldH: number;
  private scale = 1;
  private readonly scenery: HTMLCanvasElement;
  private readonly sprites = new Map<string, { canvas: HTMLCanvasElement; shadow?: HTMLCanvasElement }>();
  private readonly light: HTMLCanvasElement;
  private readonly blocked: Uint8Array;
  private readonly cols: number;
  private readonly rows: number;
  private readonly roomAt: (x: number, y: number) => string | null;
  private readonly agents: Agent[] = [];
  private readonly random = seededRandom('lab-office');
  private now = 0;
  private hover: Agent | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly layout: OfficeLayout,
    people: Person[],
    private readonly options: OfficeOptions = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.pen = canvasPen(this.ctx);
    this.worldW = layout.width * TILE;
    this.worldH = layout.height * TILE;
    this.roomAt = roomFinder(layout);
    this.scenery = this.bakeScenery();
    this.light = document.createElement('canvas');
    this.light.width = Math.ceil(this.worldW / 4);
    this.light.height = Math.ceil(this.worldH / 4);

    // Walkable grid (half tiles), for paths around walls and furniture.
    this.cols = Math.ceil(this.worldW / CELL);
    this.rows = Math.ceil(this.worldH / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    const obstacles = layout.walls.map(wallCollider);
    for (const item of layout.furniture) {
      if (!FURNITURE[item.kind].solid) continue;
      const b = itemBounds(item);
      obstacles.push({ x: b.x * TILE + 2, y: b.y * TILE + 2, w: b.w * TILE - 4, h: b.h * TILE - 4 });
    }
    for (const o of obstacles) {
      const c0 = Math.max(0, Math.floor((o.x - PAD) / CELL));
      const c1 = Math.min(this.cols - 1, Math.floor((o.x + o.w + PAD) / CELL));
      const r0 = Math.max(0, Math.floor((o.y - PAD) / CELL));
      const r1 = Math.min(this.rows - 1, Math.floor((o.y + o.h + PAD) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.blocked[r * this.cols + c] = 1;
    }

    // People get the first desks; about a quarter stay free.
    const desks = numberedDesks(layout).map((d) => d.desk);
    const count = Math.min(people.length, Math.max(1, Math.ceil(desks.length * 0.75)));
    for (let i = 0; i < count; i++) {
      const desk = desks[i];
      const s = seatPoint(desk);
      const rot = desk.rotation ?? 0;
      const dir: Direction = rot === 0 ? 'up' : rot === 180 ? 'down' : rot === 90 ? 'right' : 'left';
      const arrive = 7.2 + this.random() * 2.2;
      const owl = i === 1;
      this.agents.push({
        ...people[i],
        id: i,
        desk,
        seat: { x: s.x * TILE, y: s.y * TILE + 6, dir },
        x: s.x * TILE,
        y: s.y * TILE + 6,
        dir,
        phase: 0,
        path: [],
        activity: 'desk',
        until: 2000 + this.random() * 8000,
        face: dir,
        mugUntil: 0,
        arrive,
        leave: owl ? 23.4 : 16.8 + this.random() * 2.8,
        present: true,
        wear: 0,
        inCall: false,
        talking: false,
        with: null,
      });
    }
    this.placeForHour(true);

    canvas.addEventListener('pointermove', (e) => {
      this.hover = this.agentAt(e);
      canvas.style.cursor = this.hover ? 'pointer' : 'default';
    });
    canvas.addEventListener('pointerleave', () => (this.hover = null));
    canvas.addEventListener('click', (e) => {
      const a = this.agentAt(e);
      if (a) this.options.onPick?.(a);
    });
  }

  get people(): Person[] {
    return this.agents;
  }

  setRecipe(index: number, recipe: Recipe) {
    if (this.agents[index]) this.agents[index].recipe = recipe;
  }

  /** Jump to an hour: people who should be in appear at their desks, the rest are out. */
  setHour(hour: number) {
    this.hour = ((hour % 24) + 24) % 24;
    this.placeForHour(true);
  }

  private placeForHour(snap: boolean) {
    for (const a of this.agents) {
      const inHours = this.hour >= a.arrive && this.hour < a.leave;
      a.wear = inHours ? (this.hour - a.arrive) / (a.leave - a.arrive) : this.hour >= a.leave ? 1 : 0;
      if (snap) {
        a.present = inHours;
        a.activity = inHours ? 'desk' : 'away';
        a.x = a.seat.x;
        a.y = a.seat.y;
        a.dir = a.seat.dir;
        a.path = [];
        a.with = null;
      }
    }
  }

  private agentAt(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const wx = ((e.clientX - rect.left) / rect.width) * this.worldW;
    const wy = ((e.clientY - rect.top) / rect.height) * this.worldH;
    let best: Agent | null = null;
    for (const a of this.agents) {
      if (!a.present) continue;
      if (Math.abs(wx - a.x) < 14 && wy < a.y + 4 && wy > a.y - 56 && (!best || a.y > best.y)) best = a;
    }
    return best;
  }

  // ------------------------------------------------------------------ paths
  private free(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && !this.blocked[r * this.cols + c];
  }

  private nearestFree(c: number, r: number): [number, number] {
    if (this.free(c, r)) return [c, r];
    for (let d = 1; d < 12; d++) {
      for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) === d && this.free(c + dc, r + dr)) return [c + dc, r + dr];
      }
    }
    return [c, r];
  }

  private findPath(fx: number, fy: number, tx: number, ty: number) {
    const [sc, sr] = this.nearestFree(Math.floor(fx / CELL), Math.floor(fy / CELL));
    const [gc, gr] = this.nearestFree(Math.floor(tx / CELL), Math.floor(ty / CELL));
    const prev = new Int32Array(this.cols * this.rows).fill(-1);
    const start = sr * this.cols + sc;
    const goal = gr * this.cols + gc;
    prev[start] = start;
    const queue = [start];
    for (let qi = 0; qi < queue.length && prev[goal] < 0; qi++) {
      const cur = queue[qi];
      const c = cur % this.cols;
      const r = (cur - c) / this.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (!this.free(nc, nr) || (dc && dr && (!this.free(c + dc, r) || !this.free(c, r + dr)))) continue;
        const n = nr * this.cols + nc;
        if (prev[n] >= 0) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
    if (prev[goal] < 0) return [{ x: tx, y: ty }];
    const cells: number[] = [];
    for (let n = goal; n !== start; n = prev[n]) cells.push(n);
    const points = cells.reverse().map((n) => ({ x: (n % this.cols) * CELL + CELL / 2, y: Math.floor(n / this.cols) * CELL + CELL / 2 }));
    points.push({ x: tx, y: ty });
    // Skip corners when there's a straight line of sight.
    const out: { x: number; y: number }[] = [];
    let from = { x: fx, y: fy };
    let i = 0;
    while (i < points.length) {
      let j = points.length - 1;
      while (j > i && !this.clear(from, points[j])) j--;
      out.push(points[j]);
      from = points[j];
      i = j + 1;
    }
    return out;
  }

  private clear(a: { x: number; y: number }, b: { x: number; y: number }) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
    for (let s = 1; s < steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      if (!this.free(Math.floor(x / CELL), Math.floor(y / CELL))) return false;
    }
    return true;
  }

  private walk(a: Agent, x: number, y: number, face: Direction) {
    a.path = this.findPath(a.x, a.y, x, y);
    a.face = face;
  }

  // ------------------------------------------------------------------ the day
  private pickRoomPoint(kind: 'lounge' | 'meeting') {
    const rooms = this.layout.rooms.filter((r) => r.kind === kind);
    if (!rooms.length) return null;
    const room = rooms[Math.floor(this.random() * rooms.length)];
    if (kind === 'meeting') {
      const chairs = this.layout.furniture.filter((f) => f.kind === 'chair' && this.roomAt(f.x, f.y) === room.id);
      return { room, chairs };
    }
    for (let tries = 0; tries < 30; tries++) {
      const x = (room.x + 1 + this.random() * (room.w - 2)) * TILE;
      const y = (room.y + 2 + this.random() * (room.h - 3)) * TILE;
      if (this.free(Math.floor(x / CELL), Math.floor(y / CELL))) return { room, x, y };
    }
    return null;
  }

  private chairFacing(chair: Furniture): Direction {
    const r = chair.rotation ?? 0;
    return r === 0 ? 'up' : r === 180 ? 'down' : r === 90 ? 'right' : 'left';
  }

  private decide(a: Agent) {
    const idle = this.agents.filter((o) => o !== a && o.present && o.activity === 'desk' && !o.path.length);
    const roll = this.random();
    const late = this.hour > 20;
    if (roll < 0.34 || late) {
      a.activity = 'desk';
      a.until = this.now + 7000 + this.random() * 9000;
      this.walk(a, a.seat.x, a.seat.y, a.seat.dir);
    } else if (roll < 0.52) {
      const counter = this.layout.furniture.find((f) => f.kind === 'counter' || f.kind === 'barTable');
      if (!counter) return this.decideDesk(a);
      const b = itemBounds(counter);
      a.activity = 'coffee';
      a.until = this.now + 9000;
      this.walk(a, (b.x + b.w / 2 + (this.random() - 0.5) * 1.6) * TILE, (b.y + b.h + 0.9) * TILE, 'up');
    } else if (roll < 0.66) {
      const p = this.pickRoomPoint('lounge');
      if (!p || !('x' in p)) return this.decideDesk(a);
      a.activity = 'lounge';
      a.until = this.now + 9000 + this.random() * 6000;
      this.walk(a, p.x!, p.y!, 'down');
    } else if (roll < 0.83 && idle.length) {
      const friend = idle[Math.floor(this.random() * idle.length)];
      a.activity = 'visit';
      a.with = friend.id;
      a.until = this.now + 9000 + this.random() * 4000;
      const side = this.random() < 0.5 ? -1 : 1;
      this.walk(a, friend.seat.x + side * 26, friend.seat.y + 4, side < 0 ? 'right' : 'left');
    } else {
      const m = this.pickRoomPoint('meeting');
      if (!m || !('chairs' in m) || !m.chairs?.length) return this.decideDesk(a);
      const group = [a, ...idle.slice(0, 1 + Math.floor(this.random() * 2))];
      const chairs = [...m.chairs].sort(() => this.random() - 0.5);
      group.forEach((g, i) => {
        const chair = chairs[i % chairs.length];
        g.activity = 'meeting';
        g.with = null;
        g.until = this.now + 14000 + this.random() * 5000;
        this.walk(g, chair.x * TILE, chair.y * TILE + 6, this.chairFacing(chair));
      });
    }
  }

  private decideDesk(a: Agent) {
    a.activity = 'desk';
    a.until = this.now + 6000;
    this.walk(a, a.seat.x, a.seat.y, a.seat.dir);
  }

  tick(dt: number, hoursPerSecond: number) {
    this.now += dt;
    const before = this.hour;
    this.hour = (this.hour + (dt / 1000) * hoursPerSecond) % 24;
    if (this.hour < before) this.placeForHour(false);
    const spawn = { x: this.layout.spawn.x * TILE, y: this.layout.spawn.y * TILE };

    for (const a of this.agents) {
      const inHours = this.hour >= a.arrive && this.hour < a.leave;
      a.wear = inHours ? (this.hour - a.arrive) / (a.leave - a.arrive) : this.hour >= a.leave ? 1 : a.wear;
      if (inHours && !a.present) {
        a.present = true;
        a.wear = 0;
        a.x = spawn.x;
        a.y = spawn.y;
        a.activity = 'arriving';
        this.walk(a, a.seat.x, a.seat.y, a.seat.dir);
      } else if (!inHours && a.present && a.activity !== 'leaving') {
        a.activity = 'leaving';
        a.with = null;
        this.walk(a, spawn.x, spawn.y, 'down');
      }
      if (!a.present) continue;

      // Walk along the path.
      let vx = 0;
      let vy = 0;
      if (a.path.length) {
        const target = a.path[0];
        const dx = target.x - a.x;
        const dy = target.y - a.y;
        const d = Math.hypot(dx, dy);
        const step = (WALK * dt) / 1000;
        if (d <= step) {
          a.x = target.x;
          a.y = target.y;
          a.path.shift();
          if (!a.path.length) {
            a.dir = a.face;
            if (a.activity === 'leaving') a.present = false;
            if (a.activity === 'arriving') {
              a.activity = 'desk';
              a.until = this.now + 4000;
            }
            if (a.activity === 'coffee') a.mugUntil = this.now + 26000;
          }
        } else {
          vx = (dx / d) * step;
          vy = (dy / d) * step;
          a.x += vx;
          a.y += vy;
          a.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
        }
      }
      a.phase = a.path.length ? a.phase + dt * 0.016 : 0;
      if (!a.path.length && this.now > a.until && a.activity !== 'leaving' && a.activity !== 'arriving') this.decide(a);
    }

    // Proximity calls: people near each other in the same room hear each other,
    // except those focusing at their own desk (their status mutes them).
    for (const a of this.agents) a.inCall = false;
    const open = this.agents.filter((a) => a.present && !a.path.length && a.activity !== 'desk');
    const groups: Agent[][] = [];
    for (const a of open) {
      const room = this.roomAt(a.x / TILE, a.y / TILE);
      // A meeting room is one call for everyone inside (Z4); elsewhere it's distance (Z3).
      const meeting = this.layout.rooms.find((r) => r.id === room)?.kind === 'meeting';
      const mates = this.agents.filter(
        (b) => b !== a && b.present && !b.path.length && (b.activity !== 'desk' || b.id === a.with) &&
          this.roomAt(b.x / TILE, b.y / TILE) === room && (meeting || Math.hypot(b.x - a.x, b.y - a.y) < NEAR * TILE),
      );
      if (!mates.length) continue;
      for (const m of [a, ...mates]) m.inCall = true;
      const existing = groups.find((g) => g.includes(a) || mates.some((m) => g.includes(m)));
      if (existing) for (const m of [a, ...mates]) !existing.includes(m) && existing.push(m);
      else groups.push([a, ...mates]);
    }
    for (const a of this.agents) a.talking = false;
    for (const g of groups) {
      const speaker = g[Math.floor(this.now / 1900 + g[0].id) % g.length];
      speaker.talking = true;
    }
    this.calls = groups;
  }

  private calls: Agent[][] = [];

  // ------------------------------------------------------------------ drawing
  private bakeScenery() {
    const res = 2;
    const c = document.createElement('canvas');
    c.width = this.worldW * res;
    c.height = this.worldH * res;
    const ctx = c.getContext('2d')!;
    ctx.scale(res, res);
    ctx.fillStyle = '#e4e0da';
    ctx.fillRect(0, 0, this.worldW, this.worldH);
    const shim = new CanvasGraphics(ctx);
    for (const room of this.layout.rooms) drawFloor(shim.g, room);
    const walls = [...this.layout.walls].sort((a, b) => Number(a.y1 === a.y2) - Number(b.y1 === b.y2) || a.y1 - b.y1);
    for (const wall of walls) drawWall(shim.g, wall);
    ctx.font = '700 13px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '4px';
    for (const room of this.layout.rooms) {
      ctx.fillStyle = room.floor === 'carpet' ? 'rgba(255,255,255,.55)' : 'rgba(63,63,70,.4)';
      ctx.fillText(room.name.toUpperCase(), (room.x + room.w / 2) * TILE, (room.y + room.h / 2) * TILE);
    }
    return c;
  }

  private sprite(item: Furniture) {
    let s = this.sprites.get(item.id);
    if (s) return s;
    const res = 2;
    const pad = 4;
    const w = item.w * TILE;
    const h = item.h * TILE;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((w + pad * 2) * res);
    canvas.height = Math.ceil((h + pad * 2) * res);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(res, res);
    ctx.translate(w / 2 + pad, h / 2 + pad);
    FURNITURE[item.kind].draw(new CanvasGraphics(ctx).g, w, h, seededRandom(item.id), item.color);
    s = { canvas };
    this.sprites.set(item.id, s);
    return s;
  }

  render(width: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = width;
    const cssH = (width * this.worldH) / this.worldW;
    if (this.canvas.width !== Math.round(cssW * dpr)) {
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.canvas.style.height = `${cssH}px`;
    }
    this.scale = (cssW * dpr) / this.worldW;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.drawImage(this.scenery, 0, 0, this.worldW, this.worldH);

    const lights: DeskLight[] = [];
    const owners = new Map(this.agents.map((a) => [a.desk?.id, a]));
    const ordered = [...this.layout.furniture].sort((a, b) => {
      const depth = (f: Furniture) => {
        const spec = FURNITURE[f.kind];
        const bb = itemBounds(f);
        return spec.layer === 'floor' ? -1e6 : (bb.y + bb.h) * TILE + (spec.layer === 'wall' ? 40 : 0);
      };
      return depth(a) - depth(b);
    });
    // Shadows under solid pieces (same light direction as everything else).
    for (const f of ordered) {
      if (!FURNITURE[f.kind].solid) continue;
      const b = itemBounds(f);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.beginPath();
      if (FURNITURE[f.kind].round) ctx.ellipse((b.x + b.w / 2) * TILE + 1, (b.y + b.h / 2) * TILE + 4, b.w * TILE * 0.4, b.h * TILE * 0.37, 0, 0, Math.PI * 2);
      else ctx.roundRect(b.x * TILE + 1, b.y * TILE + 4, b.w * TILE + 2, b.h * TILE, 8);
      ctx.fill();
    }
    for (const f of ordered) {
      const angle = ((f.rotation ?? 0) * Math.PI) / 180;
      if (f.kind === 'desk') {
        const owner = owners.get(f.id);
        this.pen.push(f.x * TILE, f.y * TILE, angle);
        const local = drawDesk(this.pen, f.w * TILE, f.h * TILE, {
          seed: f.id,
          owner: owner?.recipe ?? null,
          wear: owner?.wear ?? 0,
          headsetOn: owner?.inCall,
          time: owner?.present ? this.now : undefined,
        });
        this.pen.pop();
        if (owner?.present) {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          for (const l of local) lights.push({ ...l, x: f.x * TILE + l.x * cos - l.y * sin, y: f.y * TILE + l.x * sin + l.y * cos });
        }
        continue;
      }
      const s = this.sprite(f);
      ctx.save();
      ctx.translate(f.x * TILE, f.y * TILE);
      ctx.rotate(angle);
      ctx.drawImage(s.canvas, -s.canvas.width / 4, -s.canvas.height / 4, s.canvas.width / 2, s.canvas.height / 2);
      ctx.restore();
      if (f.kind === 'floorLamp') lights.push({ x: f.x * TILE, y: f.y * TILE, radius: 110, color: GLOW.lamp, strength: 0.9 });
    }

    // Calls: soft rings around whoever is talking, threads between the group.
    for (const g of this.calls) {
      for (let i = 1; i < g.length; i++) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(g[0].x, g[0].y - 20);
        ctx.lineTo(g[i].x, g[i].y - 20);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const speaker = g.find((a) => a.talking);
      if (speaker) {
        for (let k = 0; k < 2; k++) {
          const t = ((this.now / 900 + k * 0.5) % 1 + 1) % 1;
          ctx.globalAlpha = 0.5 * (1 - t);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(speaker.x, speaker.y - 38, 14 + t * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // People, back to front.
    const people = this.agents.filter((a) => a.present).sort((a, b) => a.y - b.y);
    if (this.showRadius) {
      for (const a of people) {
        if (a.activity === 'desk' && !a.path.length) continue;
        ctx.globalAlpha = a.inCall ? 0.14 : 0.06;
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, NEAR * TILE, NEAR * TILE * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (const a of people) {
      const working = a.activity === 'desk' && !a.path.length;
      const night = this.hour >= 21 || this.hour < 6;
      const mood: Mood = working ? (night ? 'sleepy' : 'focus') : a.activity === 'coffee' || a.activity === 'lounge' || a.inCall ? 'happy' : 'neutral';
      this.pen.push(a.x, a.y);
      drawCharacter(this.pen, a.recipe, {
        dir: a.dir,
        phase: a.phase,
        moving: a.path.length > 0,
        time: this.now + a.id * 977,
        mood: a.talking ? 'neutral' : mood,
        headset: a.inCall,
        talking: a.talking,
        mug: this.now < a.mugUntil,
        shadow: true,
      });
      this.pen.pop();
    }

    // Light: the sky colour multiplied over everything, lamps and screens added back.
    const sky = skyAt(this.hour);
    const dark = 1 - luminance(sky);
    if (dark > 0.02) {
      // Occupied rooms get their ceiling lights on at dusk.
      for (const room of this.layout.rooms) {
        if (!people.some((a) => this.roomAt(a.x / TILE, a.y / TILE) === room.id)) continue;
        lights.push({ x: (room.x + room.w / 2) * TILE, y: (room.y + room.h / 2) * TILE, radius: Math.max(room.w, room.h) * TILE * 0.55, color: 0xfff1d6, strength: 0.45 });
      }
      const l = this.light.getContext('2d')!;
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'source-over';
      l.fillStyle = css(sky);
      l.fillRect(0, 0, this.light.width, this.light.height);
      l.globalCompositeOperation = 'lighter';
      l.setTransform(this.light.width / this.worldW, 0, 0, this.light.height / this.worldH, 0, 0);
      for (const lt of lights) {
        const g = l.createRadialGradient(lt.x, lt.y, 0, lt.x, lt.y, lt.radius);
        const col = css(lt.color);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        l.globalAlpha = Math.min(1, lt.strength * dark * 1.3);
        l.fillStyle = g;
        l.fillRect(lt.x - lt.radius, lt.y - lt.radius, lt.radius * 2, lt.radius * 2);
      }
      l.globalAlpha = 1;
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(this.light, 0, 0, this.worldW, this.worldH);
      // A faint glow on top so screens and lamps read as light sources.
      ctx.globalCompositeOperation = 'lighter';
      for (const lt of lights) {
        if (lt.radius > 120) continue;
        const g = ctx.createRadialGradient(lt.x, lt.y, 0, lt.x, lt.y, lt.radius * 0.45);
        g.addColorStop(0, css(lt.color));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.18 * dark * lt.strength;
        ctx.fillStyle = g;
        ctx.fillRect(lt.x - lt.radius, lt.y - lt.radius, lt.radius * 2, lt.radius * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // Name tags (after the light, so they stay readable at night).
    ctx.font = '600 10px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0px';
    for (const a of people) {
      const label = a.name;
      const w = ctx.measureText(label).width + 16;
      const y = a.y - 66 - a.recipe.height * 1.6;
      ctx.globalAlpha = a === this.hover ? 0.95 : 0.78;
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.roundRect(a.x - w / 2, y - 8, w, 16, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = a.inCall ? '#34d399' : a.activity === 'desk' && !a.path.length ? '#fbbf24' : '#a1a1aa';
      ctx.beginPath();
      ctx.arc(a.x - w / 2 + 7, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, a.x + 3, y + 0.5);
    }
  }
}

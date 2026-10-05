import type { Page } from '@playwright/test';
import type { Layout } from './helpers';

// Walks a player somewhere in the office: a path on the layout (same
// obstacles as the game), then arrow keys with the minimap as position
// feedback. Units: tiles.

const SOLID = new Set([
  'desk', 'divider', 'meetingTable', 'sofa', 'armchair', 'coffeeTable',
  'plant', 'bookshelf', 'counter', 'fridge', 'barTable', 'beanbag',
]);
const WALL = { solid: { t: 10, face: 34 }, glass: { t: 6, face: 18 } };
const TILE = 32;
const STEP = 0.25;

type Rect = { x: number; y: number; w: number; h: number };

function obstacles(layout: Layout): Rect[] {
  const rects: Rect[] = [];
  for (const f of layout.furniture) {
    if (!SOLID.has(f.kind)) continue;
    const turned = f.rotation === 90 || f.rotation === 270;
    const w = turned ? f.h : f.w;
    const h = turned ? f.w : f.h;
    rects.push({ x: (f.x - w / 2) * TILE + 2, y: (f.y - h / 2) * TILE + 2, w: w * TILE - 4, h: h * TILE - 4 });
  }
  for (const wall of layout.walls) {
    const { t, face } = WALL[wall.kind];
    if (wall.y1 === wall.y2) {
      const x = Math.min(wall.x1, wall.x2) * TILE;
      rects.push({ x, y: wall.y1 * TILE - t / 2, w: Math.abs(wall.x2 - wall.x1) * TILE, h: t + (wall.face === false ? 0 : face) });
    } else {
      rects.push({ x: wall.x1 * TILE - t / 2, y: Math.min(wall.y1, wall.y2) * TILE, w: t, h: Math.abs(wall.y2 - wall.y1) * TILE });
    }
  }
  return rects;
}

function planner(layout: Layout) {
  const rects = obstacles(layout);
  const free = (x: number, y: number) => {
    const b = { x: x * TILE - 11, y: y * TILE - 12, w: 22, h: 13 }; // the body, plus a little margin
    if (b.x < 0 || b.y < 0 || b.x + b.w > layout.width * TILE || b.y + b.h > layout.height * TILE) return false;
    return !rects.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  };
  const W = Math.floor(layout.width / STEP);
  const H = Math.floor(layout.height / STEP);

  return (fx: number, fy: number, tx: number, ty: number) => {
    let goal: [number, number] | null = null;
    let best = Infinity;
    for (let gy = 0; gy < H; gy++) {
      for (let gx = 0; gx < W; gx++) {
        const d = Math.hypot(gx * STEP - tx, gy * STEP - ty);
        if (d < best && d < 2 && free(gx * STEP, gy * STEP)) [best, goal] = [d, [gx, gy]];
      }
    }
    if (!goal) return null;
    let sx = Math.round(fx / STEP);
    let sy = Math.round(fy / STEP);
    // Standing a bit too close to something: start from the nearest free cell.
    if (!free(sx * STEP, sy * STEP)) {
      let nd = Infinity;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          if (free((sx + dx) * STEP, (sy + dy) * STEP) && Math.hypot(dx, dy) < nd) {
            nd = Math.hypot(dx, dy);
            [sx, sy] = [sx + dx, sy + dy];
          }
        }
      }
    }
    const prev = new Map<string, string | null>([[`${sx},${sy}`, null]]);
    const queue: [number, number][] = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (x === goal[0] && y === goal[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${x + dx},${y + dy}`;
        if (prev.has(key) || !free((x + dx) * STEP, (y + dy) * STEP)) continue;
        prev.set(key, `${x},${y}`);
        queue.push([x + dx, y + dy]);
      }
    }
    let key: string | null | undefined = `${goal[0]},${goal[1]}`;
    if (!prev.has(key)) return null;
    const cells: [number, number][] = [];
    while (key) {
      const [x, y] = key.split(',').map(Number);
      cells.unshift([x * STEP, y * STEP]);
      key = prev.get(key);
    }
    // Keep the corners only.
    const route: { x: number; y: number; axis: 'x' | 'y' }[] = [];
    for (let i = 1; i < cells.length; i++) {
      const [px, py] = cells[i - 1];
      const [x, y] = cells[i];
      const next = cells[i + 1];
      if (!next || next[0] - x !== x - px || next[1] - y !== y - py) route.push({ x, y, axis: x !== px ? 'x' : 'y' });
    }
    return route;
  };
}

/** Where the local player is, from the minimap (tiles). */
export async function position(page: Page) {
  const handle = page.locator('circle[fill="#10b981"]');
  await handle.waitFor({ state: 'attached' });
  const [cx, cy] = await Promise.all([handle.getAttribute('cx'), handle.getAttribute('cy')]);
  return { x: Number(cx), y: Number(cy) + 0.4 };
}

async function along(page: Page, target: { x: number; y: number }, axis: 'x' | 'y') {
  for (let i = 0; i < 40; i++) {
    const at = await position(page);
    const d = axis === 'x' ? target.x - at.x : target.y - at.y;
    if (Math.abs(d) < 0.15) return;
    const key = axis === 'x' ? (d < 0 ? 'ArrowLeft' : 'ArrowRight') : d < 0 ? 'ArrowUp' : 'ArrowDown';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.max(25, Math.min(500, Math.abs(d) * 150)));
    await page.keyboard.up(key);
    await page.waitForTimeout(170);
  }
}

/** Walks to (tx, ty), or the closest free spot. Returns where the player ended. */
export async function walkTo(page: Page, layout: Layout, tx: number, ty: number) {
  const path = planner(layout);
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = await position(page);
    const route = path(at.x, at.y, tx, ty);
    if (!route) throw new Error(`No path from ${at.x},${at.y} to ${tx},${ty}`);
    for (const point of route) await along(page, point, point.axis);
    const end = await position(page);
    const last = route[route.length - 1] ?? at;
    if (Math.hypot(end.x - last.x, end.y - last.y) < 0.4) return end;
  }
  return position(page);
}

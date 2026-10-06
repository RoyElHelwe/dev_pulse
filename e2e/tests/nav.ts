import type { Page } from '@playwright/test';
import type { Layout } from './helpers';

// Walks a player somewhere in the office: a path on the layout (same
// obstacles as the game), then arrow keys with the minimap as position
// feedback. Units: tiles.

const SOLID = new Set([
  'desk', 'divider', 'meetingTable', 'sofa', 'armchair', 'coffeeTable',
  'plant', 'bookshelf', 'counter', 'fridge', 'barTable', 'beanbag', 'board',
]);
const WALL = { solid: { t: 10, face: 34 }, glass: { t: 6, face: 18 } };
const TILE = 32;
const STEP = 0.25;
const INFLATE = 5;

type Rect = { x: number; y: number; w: number; h: number };

function obstacles(layout: Layout, tx?: number, ty?: number, extra: Rect[] = []): Rect[] {
  const rects: Rect[] = [...extra];
  for (const f of layout.furniture) {
    const isGoal = tx !== undefined && ty !== undefined && Math.hypot(f.x - tx, f.y - ty) < 0.8;
    if (isGoal) continue;
    const isSolid = SOLID.has(f.kind);
    const isSeat = f.kind === 'chair' || f.kind === 'stool' || f.kind === 'armchair';
    if (!isSolid && !isSeat) continue;
    const turned = f.rotation === 90 || f.rotation === 270;
    const w = turned ? f.h : f.w;
    const h = turned ? f.w : f.h;
    rects.push({
      x: (f.x - w / 2) * TILE - INFLATE,
      y: (f.y - h / 2) * TILE - INFLATE,
      w: w * TILE + INFLATE * 2,
      h: h * TILE + INFLATE * 2,
    });
  }
  for (const wall of layout.walls) {
    const { t, face } = WALL[wall.kind];
    if (wall.y1 === wall.y2) {
      const x = Math.min(wall.x1, wall.x2) * TILE;
      rects.push({
        x: x - INFLATE,
        y: wall.y1 * TILE - t / 2 - INFLATE,
        w: Math.abs(wall.x2 - wall.x1) * TILE + INFLATE * 2,
        h: t + (wall.face === false ? 0 : face) + INFLATE * 2,
      });
    } else {
      rects.push({
        x: wall.x1 * TILE - t / 2 - INFLATE,
        y: Math.min(wall.y1, wall.y2) * TILE - t / 2 - INFLATE,
        w: t + INFLATE * 2,
        h: Math.abs(wall.y2 - wall.y1) * TILE + t + INFLATE * 2,
      });
    }
  }
  return rects;
}

function planner(layout: Layout, tx?: number, ty?: number, extra: Rect[] = []) {
  const rects = obstacles(layout, tx, ty, extra);
  const free = (x: number, y: number) => {
    const b = { x: x * TILE - 8, y: y * TILE - 9, w: 16, h: 9 };
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
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
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

function isNearSeat(layout: Layout, at: { x: number; y: number }): boolean {
  return layout.furniture.some(
    (f) => (f.kind === 'chair' || f.kind === 'stool' || f.kind === 'armchair') && Math.hypot(f.x - at.x, f.y - at.y) < 0.6,
  );
}

async function along(
  page: Page,
  layout: Layout,
  target: { x: number; y: number },
  axis: 'x' | 'y',
  isFinal = false,
): Promise<'reached' | 'blocked'> {
  let prevPos = { x: Infinity, y: Infinity };
  let stuckCount = 0;
  let noProgressCount = 0;
  let standingAttempts = 0;

  for (let i = 0; i < 40; i++) {
    const at = await position(page);
    const d = axis === 'x' ? target.x - at.x : target.y - at.y;
    const threshold = isFinal ? 0.2 : 0.15;
    if (Math.abs(d) <= threshold) return 'reached';

    const moved = Math.hypot(at.x - prevPos.x, at.y - prevPos.y);
    if (moved < 0.02) {
      stuckCount++;
      noProgressCount++;
    } else {
      stuckCount = 0;
      noProgressCount = 0;
      standingAttempts = 0;
    }
    prevPos = at;

    const seated = isNearSeat(layout, at);
    const unwedge = stuckCount >= 2;
    if (unwedge) {
      if (seated) standingAttempts++;
      stuckCount = 0;
    } else if (noProgressCount >= 4) {
      return 'blocked';
    }

    const key = axis === 'x' ? (d < 0 ? 'ArrowLeft' : 'ArrowRight') : d < 0 ? 'ArrowUp' : 'ArrowDown';
    const dist = Math.abs(d);
    let pressTime: number;
    if (unwedge) {
      pressTime = seated ? 550 : 350;
    } else {
      pressTime = Math.max(50, Math.min(250, Math.round(dist * 200)));
    }

    await page.keyboard.down(key);
    await page.waitForTimeout(pressTime);
    await page.keyboard.up(key);
    await page.waitForTimeout(160);
  }

  const endAt = await position(page);
  const finalDist = Math.abs(axis === 'x' ? target.x - endAt.x : target.y - endAt.y);
  return finalDist <= (isFinal ? 0.35 : 0.3) ? 'reached' : 'blocked';
}

/** Walks to (tx, ty), or the closest free spot. Returns where the player ended. */
export async function walkTo(page: Page, layout: Layout, tx: number, ty: number) {
  const startMs = Date.now();
  const extraObstacles: Rect[] = [];
  const isSeatTarget = layout.furniture.some(
    (f) => (f.kind === 'chair' || f.kind === 'stool' || f.kind === 'armchair') && Math.hypot(f.x - tx, f.y - ty) < 0.8,
  );

  for (let attempt = 0; attempt < 6; attempt++) {
    if (Date.now() - startMs > 90_000) {
      throw new Error(`walkTo timed out after 90s trying to reach (${tx}, ${ty})`);
    }

    const at = await position(page);
    if (Math.hypot(at.x - tx, at.y - ty) < 0.5) {
      if (isSeatTarget) await page.waitForTimeout(550);
      return position(page);
    }

    const path = planner(layout, tx, ty, extraObstacles);
    const route = path(at.x, at.y, tx, ty);
    if (!route) {
      if (extraObstacles.length > 0) {
        extraObstacles.pop();
        continue;
      }
      throw new Error(`No path from ${at.x},${at.y} to ${tx},${ty}`);
    }

    let blocked = false;
    for (let i = 0; i < route.length; i++) {
      if (Date.now() - startMs > 90_000) {
        throw new Error(`walkTo timed out after 90s trying to reach (${tx}, ${ty})`);
      }
      const isFinal = i === route.length - 1;
      const res = await along(page, layout, route[i], route[i].axis, isFinal);
      if (res === 'blocked') {
        const cur = await position(page);
        const dx = route[i].axis === 'x' ? Math.sign(route[i].x - cur.x) : 0;
        const dy = route[i].axis === 'y' ? Math.sign(route[i].y - cur.y) : 0;
        const bx = cur.x + dx * 0.6;
        const by = cur.y + dy * 0.6;
        if (Math.hypot(bx - tx, by - ty) > 1.2) {
          extraObstacles.push({
            x: (bx - 0.4) * TILE,
            y: (by - 0.4) * TILE,
            w: 0.8 * TILE,
            h: 0.8 * TILE,
          });
        }
        blocked = true;
        break;
      }
    }

    if (blocked) {
      continue;
    }

    if (isSeatTarget) await page.waitForTimeout(550);
    const end = await position(page);
    if (Math.hypot(end.x - tx, end.y - ty) < 0.6) return end;
  }

  const finalPos = await position(page);
  if (Math.hypot(finalPos.x - tx, finalPos.y - ty) < 0.6) return finalPos;
  throw new Error(`walkTo failed to reach (${tx}, ${ty}) after 6 attempts; ended at (${finalPos.x}, ${finalPos.y})`);
}

import type { Page } from '@playwright/test';
import type { Layout } from './helpers';

// Walks a player somewhere in the office: a path on the layout (same
// obstacles as the game), then arrow keys with the minimap as position
// feedback. Units: tiles.

const SOLID = new Set([
  'desk', 'divider', 'meetingTable', 'sofa', 'armchair', 'coffeeTable',
  'plant', 'bookshelf', 'counter', 'fridge', 'barTable', 'beanbag', 'board',
  'foosball', 'cardTable', 'legoBoard',
]);
const WALL = { solid: { t: 10 }, glass: { t: 6 } };
const TILE = 32;
const STEP = 0.25;
const INFLATE = 9;

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
    const { t } = WALL[wall.kind];
    if (wall.y1 === wall.y2) {
      const x = Math.min(wall.x1, wall.x2) * TILE;
      rects.push({
        x: x - INFLATE,
        y: wall.y1 * TILE - t / 2 - INFLATE,
        w: Math.abs(wall.x2 - wall.x1) * TILE + INFLATE * 2,
        h: t + INFLATE * 2,
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
    const b = { x: x * TILE - 9, y: y * TILE - 10, w: 18, h: 10 };
    if (b.x < 0 || b.y < 0 || b.x + b.w > layout.width * TILE || b.y + b.h > layout.height * TILE) return false;
    return !rects.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  };
  const distToObs = (px: number, py: number) => {
    let minD = Infinity;
    for (const r of rects) {
      const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
      const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
      const d = Math.hypot(dx, dy);
      if (d < minD) minD = d;
    }
    return minD;
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
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          if (free((sx + dx) * STEP, (sy + dy) * STEP) && Math.hypot(dx, dy) < nd) {
            nd = Math.hypot(dx, dy);
            [sx, sy] = [sx + dx, sy + dy];
          }
        }
      }
    }
    interface PQNode {
      x: number;
      y: number;
      dir: number; // 0: none, 1: dx=1, 2: dx=-1, 3: dy=1, 4: dy=-1
      cost: number;
      priority: number;
    }
    const pq: PQNode[] = [];
    const push = (node: PQNode) => {
      pq.push(node);
      let i = pq.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (pq[p].priority <= pq[i].priority) break;
        [pq[p], pq[i]] = [pq[i], pq[p]];
        i = p;
      }
    };
    const pop = (): PQNode | undefined => {
      if (!pq.length) return undefined;
      const top = pq[0];
      const bottom = pq.pop()!;
      if (pq.length) {
        pq[0] = bottom;
        let i = 0;
        while (true) {
          const left = (i << 1) + 1;
          const right = left + 1;
          let smallest = i;
          if (left < pq.length && pq[left].priority < pq[smallest].priority) smallest = left;
          if (right < pq.length && pq[right].priority < pq[smallest].priority) smallest = right;
          if (smallest === i) break;
          [pq[i], pq[smallest]] = [pq[smallest], pq[i]];
          i = smallest;
        }
      }
      return top;
    };

    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    dist.set(`${sx},${sy},0`, 0);
    push({ x: sx, y: sy, dir: 0, cost: 0, priority: 0 });

    let endState: PQNode | null = null;
    while (pq.length) {
      const curr = pop()!;
      if (curr.x === goal[0] && curr.y === goal[1]) {
        endState = curr;
        break;
      }
      const currentKey = `${curr.x},${curr.y},${curr.dir}`;
      if (curr.cost > (dist.get(currentKey) ?? Infinity)) continue;

      const dirs: [number, number, number][] = [
        [0, -1, 4], // up
        [-1, 0, 2], // left
        [1, 0, 1], // right
        [0, 1, 3], // down
      ];
      for (const [dx, dy, dirCode] of dirs) {
        const nx = curr.x + dx;
        const ny = curr.y + dy;
        if (!free(nx * STEP, ny * STEP)) continue;
        const turnCost = curr.dir !== 0 && curr.dir !== dirCode ? 4 : 0;
        const obsD = distToObs(nx * STEP * TILE, ny * STEP * TILE);
        const clearCost = obsD < 24 ? Math.round((24 - obsD) / 3) : 0;
        const nextCost = curr.cost + 1 + turnCost + clearCost;
        const nextKey = `${nx},${ny},${dirCode}`;
        if (nextCost < (dist.get(nextKey) ?? Infinity)) {
          dist.set(nextKey, nextCost);
          prev.set(nextKey, currentKey);
          const h = Math.hypot(nx - goal[0], ny - goal[1]);
          push({ x: nx, y: ny, dir: dirCode, cost: nextCost, priority: nextCost + h });
        }
      }
    }

    if (!endState) return { goal: null, route: null };

    let currKey: string | undefined = `${endState.x},${endState.y},${endState.dir}`;
    const cells: [number, number][] = [];
    while (currKey) {
      const [x, y] = currKey.split(',').map(Number);
      cells.unshift([x * STEP, y * STEP]);
      currKey = prev.get(currKey);
    }
    // Keep the corners only.
    const route: { x: number; y: number; axis: 'x' | 'y' }[] = [];
    for (let i = 1; i < cells.length; i++) {
      const [px, py] = cells[i - 1];
      const [x, y] = cells[i];
      const next = cells[i + 1];
      if (!next || next[0] - x !== x - px || next[1] - y !== y - py) route.push({ x, y, axis: x !== px ? 'x' : 'y' });
    }
    return { goal: [goal[0] * STEP, goal[1] * STEP] as [number, number], route };
  };
}

/** Where the local player is, from the minimap (tiles). */
export async function position(page: Page) {
  const handle = page.locator('circle[fill="#10b981"]');
  await handle.waitFor({ state: 'attached' });
  const [cx, cy] = await Promise.all([handle.getAttribute('cx'), handle.getAttribute('cy')]);
  return { x: Number(cx), y: Number(cy) + 0.4 };
}

/** Waits until the minimap stops changing: on a loaded machine it lags behind the avatar, which made walks overshoot. */
async function settled(page: Page) {
  let last = await position(page);
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(60);
    const now = await position(page);
    if (Math.hypot(now.x - last.x, now.y - last.y) < 0.01) return now;
    last = now;
  }
  return last;
}

function isNearSeat(layout: Layout, at: { x: number; y: number }): boolean {
  return layout.furniture.some(
    (f) => (f.kind === 'chair' || f.kind === 'stool' || f.kind === 'armchair') && Math.hypot(f.x - at.x, f.y - at.y) < 0.65,
  );
}

async function along(
  page: Page,
  layout: Layout,
  target: { x: number; y: number },
  axis: 'x' | 'y',
  isFinal = false,
  isSeatTarget = false,
  finalTarget?: { x: number; y: number },
): Promise<'reached' | 'blocked'> {
  let prevPos = { x: Infinity, y: Infinity };
  let prevD = 0;
  let stuckCount = 0;
  let noProgressCount = 0;

  for (let i = 0; i < 45; i++) {
    const at = await position(page);

    // If destination is a seat and we are already seated near it, we have arrived!
    if (isSeatTarget && finalTarget && Math.hypot(at.x - finalTarget.x, at.y - finalTarget.y) <= 0.6 && isNearSeat(layout, at)) {
      return 'reached';
    }

    const d = axis === 'x' ? target.x - at.x : target.y - at.y;
    const threshold = isFinal ? (isSeatTarget ? 0.6 : 0.35) : 0.45;
    if (Math.abs(d) <= threshold) return 'reached';

    // If we crossed the target line on an intermediate leg, or crossed close to final target, we reached it
    if (i > 0 && Math.sign(prevD) !== Math.sign(d)) {
      if (Math.abs(d) <= (isSeatTarget ? 0.6 : 0.55)) {
        return 'reached';
      }
    }

    const moved = Math.hypot(at.x - prevPos.x, at.y - prevPos.y);
    if (moved < 0.02) {
      stuckCount++;
      noProgressCount++;
    } else {
      stuckCount = 0;
      noProgressCount = 0;
    }
    prevPos = at;
    prevD = d;

    const seated = isNearSeat(layout, at);

    // If seated at an unwanted chair, hold walking key 600ms to stand up (STAND_HOLD_MS = 500)
    if (seated && !isSeatTarget && stuckCount >= 1) {
      const standKey = axis === 'x' ? (d < 0 ? 'ArrowLeft' : 'ArrowRight') : (d < 0 ? 'ArrowUp' : 'ArrowDown');
      await page.keyboard.down(standKey);
      await page.waitForTimeout(600);
      await page.keyboard.up(standKey);
      await settled(page);
      stuckCount = 0;
      if (noProgressCount >= 3) {
        return 'blocked';
      }
      continue;
    }

    // If no progress, try refocusing canvas; if really stuck, back off and report blocked
    if (noProgressCount === 2) {
      await page.bringToFront().catch(() => undefined);
      await page.locator('canvas').click({ position: { x: 600, y: 400 } }).catch(() => undefined);
    }

    if (noProgressCount >= 6) {
      const backKey = axis === 'x' ? (d < 0 ? 'ArrowRight' : 'ArrowLeft') : (d < 0 ? 'ArrowDown' : 'ArrowUp');
      await page.keyboard.down(backKey);
      await page.waitForTimeout(250);
      await page.keyboard.up(backKey);
      await settled(page);
      return 'blocked';
    }

    const key = axis === 'x' ? (d < 0 ? 'ArrowLeft' : 'ArrowRight') : d < 0 ? 'ArrowUp' : 'ArrowDown';
    const dist = Math.abs(d);
    const pressTime = Math.max(40, Math.min(200, Math.round(dist * 120)));

    await page.keyboard.down(key);
    await page.waitForTimeout(pressTime);
    await page.keyboard.up(key);
    await settled(page);
  }

  const endAt = await position(page);
  if (isSeatTarget && finalTarget && Math.hypot(endAt.x - finalTarget.x, endAt.y - finalTarget.y) <= 0.6) {
    return 'reached';
  }
  const finalDist = Math.abs(axis === 'x' ? target.x - endAt.x : target.y - endAt.y);
  if (finalDist <= (isFinal ? (isSeatTarget ? 0.6 : 0.45) : 0.45)) {
    return 'reached';
  }

  // If blocked, back off slightly before returning
  if (noProgressCount >= 2) {
    const lastD = axis === 'x' ? target.x - endAt.x : target.y - endAt.y;
    const backKey = axis === 'x' ? (lastD < 0 ? 'ArrowRight' : 'ArrowLeft') : (lastD < 0 ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.down(backKey);
    await page.waitForTimeout(200);
    await page.keyboard.up(backKey);
    await settled(page);
    return 'blocked';
  }
  return 'reached';
}

/** Walks to (tx, ty), or the closest free spot. Returns where the player ended. */
export async function walkTo(page: Page, layout: Layout, tx: number, ty: number) {
  const startMs = Date.now();
  await page.bringToFront().catch(() => undefined);
  await page.locator('canvas').click({ position: { x: 600, y: 400 } }).catch(() => undefined);

  const extraObstacles: Rect[] = [];
  const isSeatTarget = layout.furniture.some(
    (f) => (f.kind === 'chair' || f.kind === 'stool' || f.kind === 'armchair') && Math.hypot(f.x - tx, f.y - ty) < 0.8,
  );

  const targetRoom = layout.rooms.find(
    (r) => tx >= r.x && tx <= r.x + r.w && ty >= r.y && ty <= r.y + r.h && r.kind !== 'open',
  );

  let plannedGoal: [number, number] | null = null;
  const reached = (pos: { x: number; y: number }) => {
    if (Math.hypot(pos.x - tx, pos.y - ty) < 0.85) return true;
    if (plannedGoal && Math.hypot(pos.x - plannedGoal[0], pos.y - plannedGoal[1]) < 0.55) return true;
    if (isSeatTarget && isNearSeat(layout, pos) && Math.hypot(pos.x - tx, pos.y - ty) < 0.9) return true;
    if (
      targetRoom &&
      pos.x >= targetRoom.x + 0.5 &&
      pos.x <= targetRoom.x + targetRoom.w - 0.5 &&
      pos.y >= targetRoom.y + 0.5 &&
      pos.y <= targetRoom.y + targetRoom.h - 0.5 &&
      Math.hypot(pos.x - tx, pos.y - ty) < 2.5
    ) {
      return true;
    }
    return false;
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    if (Date.now() - startMs > 150_000) {
      throw new Error(`walkTo timed out after 150s trying to reach (${tx}, ${ty})`);
    }

    const at = await position(page);
    if (reached(at)) {
      if (isSeatTarget) await page.waitForTimeout(550);
      return position(page);
    }

    let path = planner(layout, tx, ty, extraObstacles);
    let planRes = path(at.x, at.y, tx, ty);
    while (!planRes.route && extraObstacles.length > 0) {
      extraObstacles.pop();
      path = planner(layout, tx, ty, extraObstacles);
      planRes = path(at.x, at.y, tx, ty);
    }
    if (!planRes.route) {
      throw new Error(`No path from ${at.x},${at.y} to ${tx},${ty}`);
    }
    plannedGoal = planRes.goal;
    const route = planRes.route;

    let blocked = false;
    for (let i = 0; i < route.length; i++) {
      if (Date.now() - startMs > 150_000) {
        throw new Error(`walkTo timed out after 150s trying to reach (${tx}, ${ty})`);
      }

      const curCheck = await position(page);
      if (reached(curCheck)) {
        if (isSeatTarget) await page.waitForTimeout(550);
        return position(page);
      }

      const isFinal = i === route.length - 1;
      const res = await along(page, layout, route[i], route[i].axis, isFinal, isSeatTarget, { x: tx, y: ty });
      if (res === 'blocked') {
        const cur = await position(page);
        if (isNearSeat(layout, cur) && !isSeatTarget) {
          await page.keyboard.down('ArrowDown');
          await page.waitForTimeout(600);
          await page.keyboard.up('ArrowDown');
          await settled(page);
        }
        const dx = route[i].axis === 'x' ? Math.sign(route[i].x - cur.x) : 0;
        const dy = route[i].axis === 'y' ? Math.sign(route[i].y - cur.y) : 0;
        const bx = cur.x + dx * 0.6;
        const by = cur.y + dy * 0.6;
        if (Math.hypot(bx - tx, by - ty) > 2.0) {
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
    if (reached(end)) {
      return end;
    }
  }

  const finalPos = await position(page);
  if (reached(finalPos)) {
    return finalPos;
  }
  throw new Error(`walkTo failed to reach (${tx}, ${ty}) after 8 attempts; ended at (${finalPos.x}, ${finalPos.y})`);
}

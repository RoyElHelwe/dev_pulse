import { describe, expect, it } from 'vitest';
import { TILE } from './layout/geometry';
import { Budget, claimOffice, limitMove, WALK_SPEED, ZONE_ID } from './rules';

describe('Budget', () => {
  it('allows `perSecond` messages, then again the next second', () => {
    const budget = new Budget(2);
    expect([budget.allow(1000), budget.allow(1500), budget.allow(1999)]).toEqual([true, true, false]);
    expect(budget.allow(2000)).toBe(true);
  });
});

describe('ZONE_ID', () => {
  it('accepts layout ids only', () => {
    expect(ZONE_ID.test('room-atlas')).toBe(true);
    expect(ZONE_ID.test('desk:a1_2')).toBe(true);
    expect(ZONE_ID.test('a b')).toBe(false);
    expect(ZONE_ID.test('x'.repeat(65))).toBe(false);
  });
});

describe('limitMove', () => {
  const spawn = { x: 50 * TILE, y: 50 * TILE };
  const here = { x: 100, y: 100 };
  const walked = (to: { x: number; y: number }, ms: number) => limitMove(here, to, ms, spawn);

  it('accepts walking, even with uneven packets', () => {
    const steps = [{ x: 100 + WALK_SPEED / 20, y: 100 }, { x: 100 + WALK_SPEED, y: 100 }, { x: 120, y: 100 }];
    expect(walked(steps[0], 50)).toEqual(steps[0]);
    expect(walked(steps[1], 1000)).toEqual(steps[1]);
    expect(walked(steps[2], 0)).toEqual(steps[2]);
  });

  it('turns a jump into a run towards it', () => {
    const to = { x: 100 + 10 * TILE, y: 100 };
    const at = walked(to, 50);
    expect(at.y).toBe(100);
    expect(at.x).toBeGreaterThan(100);
    expect(at.x).toBeLessThan(to.x);
  });

  it('gives an idle player no more than a couple of seconds of walking', () => {
    expect(walked({ x: 100 + 40 * TILE, y: 100 }, 60_000).x).toBeLessThan(100 + 40 * TILE);
  });

  it('always accepts the entrance (arrival, layout reload, sent out of a booked room)', () => {
    const door = { x: spawn.x + TILE, y: spawn.y - TILE };
    expect(walked(door, 10)).toEqual(door);
    expect(walked({ x: spawn.x + 4 * TILE, y: spawn.y }, 10).x).toBeLessThan(spawn.x + 4 * TILE);
  });
});

describe('claimOffice', () => {
  it('allows connection when no open tabs', () => {
    expect(claimOffice([], 'A', false)).toEqual({
      refuse: false,
      drop: [],
      notify: [],
    });
  });

  it('refuses another tab without takeover', () => {
    expect(claimOffice([{ id: 's1', tabId: 'A' }], 'B', false)).toEqual({
      refuse: true,
      drop: [],
      notify: [],
    });
  });

  it('drops and notifies old tab when takeover is true', () => {
    const s1 = { id: 's1', tabId: 'A' };
    expect(claimOffice([s1], 'B', true)).toEqual({
      refuse: false,
      drop: [s1],
      notify: [s1],
    });
  });

  it('allows same tab reconnect without takeover and drops stale socket', () => {
    const s1 = { id: 's1', tabId: 'A' };
    expect(claimOffice([s1], 'A', false)).toEqual({
      refuse: false,
      drop: [s1],
      notify: [],
    });
  });

  it('refuses when other tabs exist even if same tab id is present without takeover', () => {
    const open = [
      { id: 's1', tabId: 'A' },
      { id: 's2', tabId: 'B' },
    ];
    expect(claimOffice(open, 'A', false)).toEqual({
      refuse: true,
      drop: [],
      notify: [],
    });
  });
});

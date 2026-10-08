import { describe, expect, it } from 'vitest';
import { campus } from '../templates/campus';
import { generatedOffice } from '../templates/generated';
import { hq } from '../templates/hq';
import { loft } from '../templates/loft';
import { studio } from '../templates/studio';
import { validateLayout } from './validate';
import { addWing, WingError, type WingSide } from './wings';

describe('wings', () => {
  const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'pulse', 'hq'];
  const sides: WingSide[] = ['LEFT', 'RIGHT', 'BOTTOM'];

  it('grows loft() on each side with multiple seeds, validating with zero problems', () => {
    for (const side of sides) {
      for (const seed of seeds) {
        const base = loft();
        const baseDesks = base.furniture.filter((f) => f.kind === 'desk').length;
        const res = addWing(base, side, seed, 1);

        // Result validates with zero problems
        const problems = validateLayout(res.layout);
        expect(problems, `Validation failed for side ${side}, seed ${seed}: ${JSON.stringify(problems)}`).toEqual([]);

        // Exactly 8 desks added
        const resDesks = res.layout.furniture.filter((f) => f.kind === 'desk').length;
        expect(resDesks).toBe(baseDesks + 8);
        expect(res.wing.deskCount).toBe(8);

        // Original furniture ids still present (LEFT: shifted by shift.x, y same)
        for (const orig of base.furniture) {
          const found = res.layout.furniture.find((f) => f.id === orig.id);
          expect(found, `Original item ${orig.id} not found in result`).toBeDefined();
          expect(found!.x).toBeCloseTo(orig.x + res.shift.x, 2);
          expect(found!.y).toBeCloseTo(orig.y, 2);
        }

        // All IDs unique
        const ids = res.layout.furniture.map((f) => f.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);

        const roomIds = res.layout.rooms.map((r) => r.id);
        expect(new Set(roomIds).size).toBe(roomIds.length);

        // Wing rect lies within layout bounds
        expect(res.wing.x).toBeGreaterThanOrEqual(0);
        expect(res.wing.y).toBeGreaterThanOrEqual(0);
        expect(res.wing.x + res.wing.w).toBeLessThanOrEqual(res.layout.width);
        expect(res.wing.y + res.wing.h).toBeLessThanOrEqual(res.layout.height);

        // New desks lie inside wing rect
        const newDesks = res.layout.furniture.filter((f) => f.kind === 'desk' && f.id.startsWith('w1-'));
        expect(newDesks.length).toBe(8);
        for (const desk of newDesks) {
          expect(desk.x).toBeGreaterThanOrEqual(res.wing.x);
          expect(desk.x).toBeLessThanOrEqual(res.wing.x + res.wing.w);
          expect(desk.y).toBeGreaterThanOrEqual(res.wing.y);
          expect(desk.y).toBeLessThanOrEqual(res.wing.y + res.wing.h);
        }

        // Special side checks
        if (side === 'BOTTOM') {
          expect(res.layout.spawn.y).toBeGreaterThan(base.height);
          expect(res.shift).toEqual({ x: 0, y: 0 });
        } else if (side === 'LEFT') {
          expect(res.shift.x).toBe(13);
          expect(res.shift.y).toBe(0);
          for (const item of res.layout.furniture) {
            expect(item.x).toBeGreaterThanOrEqual(0);
            expect(item.y).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('runs fixed chains and validates at each step', () => {
    const fixedChains: WingSide[][] = [
      ['LEFT', 'LEFT', 'LEFT'],
      ['RIGHT', 'RIGHT', 'RIGHT'],
      ['BOTTOM', 'BOTTOM', 'BOTTOM'],
      ['LEFT', 'BOTTOM', 'RIGHT', 'BOTTOM', 'LEFT'],
    ];

    for (const chain of fixedChains) {
      let current = loft();
      for (let i = 0; i < chain.length; i++) {
        const side = chain[i];
        const res = addWing(current, side, `fixed-${chain.join('-')}`, i + 1);
        const problems = validateLayout(res.layout);
        expect(problems, `Chain ${chain.join('->')} step ${i + 1} (${side}) failed: ${JSON.stringify(problems)}`).toEqual([]);
        current = res.layout;
      }
    }
  });

  it('runs at least 30 pseudo-random sequences of 6 sides, validating at each step', () => {
    function pseudoRand(seed: number) {
      let s = seed;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }

    const sidesList: WingSide[] = ['LEFT', 'RIGHT', 'BOTTOM'];

    for (let seq = 0; seq < 30; seq++) {
      const rand = pseudoRand(seq * 7919 + 42);
      let current = loft();
      const seqSides: WingSide[] = [];

      for (let step = 1; step <= 6; step++) {
        const side = sidesList[Math.floor(rand() * sidesList.length)];
        seqSides.push(side);
        const res = addWing(current, side, `chain-${seq}-${step}`, step);
        const problems = validateLayout(res.layout);
        expect(
          problems,
          `Sequence ${seq} [${seqSides.join(',')}] at step ${step} (${side}) failed: ${JSON.stringify(problems)}`,
        ).toEqual([]);
        current = res.layout;
      }
    }
  }, 15_000);

  it('throws WingError NO_DOOR when open wall is blocked by protected furniture', () => {
    const base = loft();
    // Add protected desks/chairs spanning the whole open part of the left wall region (x=0, y=12..28)
    const blockers = [];
    for (let y = 13; y <= 27; y += 1.5) {
      blockers.push({
        id: `blocker-desk-${y}`,
        kind: 'desk' as const,
        x: 1.5,
        y,
        w: 3,
        h: 1.5,
      });
      blockers.push({
        id: `blocker-chair-${y}`,
        kind: 'chair' as const,
        x: 1.5,
        y: y + 0.5,
        w: 0.85,
        h: 0.85,
      });
    }

    const blockedLayout = {
      ...base,
      furniture: [...base.furniture, ...blockers],
    };

    expect(() => addWing(blockedLayout, 'LEFT', 'test-blocked', 1)).toThrow(WingError);
    try {
      addWing(blockedLayout, 'LEFT', 'test-blocked', 1);
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(WingError);
      const wingErr = err as WingError;
      expect(wingErr.code).toBe('NO_DOOR');
      expect(wingErr.message).toContain('left wall');
    }
  });

  describe('chill wing', () => {
    const sides: WingSide[] = ['LEFT', 'RIGHT', 'BOTTOM'];

    it.each(sides)('adds chill wing on loft on side %s with valid layout', (side) => {
      const loftBase = {
        ...loft(),
        rooms: loft().rooms.map((r) => (r.kind === 'chill' ? { ...r, kind: 'lounge' as const } : r)),
        furniture: loft().furniture.filter((f) => !['foosball', 'cardTable', 'legoBoard'].includes(f.kind)),
      };
      const res = addWing(loftBase, side, `chill-loft-${side}`, 1, { special: 'chill' });
      expect(validateLayout(res.layout)).toEqual([]);
      expect(res.wing.deskCount).toBe(0);
      const chillRooms = res.layout.rooms.filter((r) => r.kind === 'chill');
      expect(chillRooms).toHaveLength(1);
      expect(chillRooms[0].name).toBe('Chill room');
      expect(res.layout.furniture.filter((f) => f.kind === 'foosball')).toHaveLength(1);
      expect(res.layout.furniture.filter((f) => f.kind === 'cardTable')).toHaveLength(1);
      expect(res.layout.furniture.filter((f) => f.kind === 'legoBoard')).toHaveLength(1);
    });

    it.each(sides)('adds chill wing directly to loft on side %s and validates', (side) => {
      const res = addWing(loft(), side, `chill-loft-direct-${side}`, 1, { special: 'chill' });
      expect(validateLayout(res.layout)).toEqual([]);
      expect(res.wing.deskCount).toBe(0);
    });

    it.each(['studio', 'campus', 'hq'] as const)('adds chill wing to %s on every side, validating with exactly one chill room', (tmpl) => {
      const templates = { studio: studio(), campus: campus(), hq: hq() };
      for (const side of sides) {
        const base = templates[tmpl];
        const res = addWing(base, side, `chill-${tmpl}-${side}`, 1, { special: 'chill' });
        expect(validateLayout(res.layout)).toEqual([]);
        expect(res.wing.deskCount).toBe(0);
        const chillRooms = res.layout.rooms.filter((r) => r.kind === 'chill');
        expect(chillRooms).toHaveLength(1);
        expect(chillRooms[0].name).toBe('Chill room');
        expect(res.layout.furniture.filter((f) => f.kind === 'foosball')).toHaveLength(1);
        expect(res.layout.furniture.filter((f) => f.kind === 'cardTable')).toHaveLength(1);
        expect(res.layout.furniture.filter((f) => f.kind === 'legoBoard')).toHaveLength(1);
      }
    });

    it('adds chill wing after a normal wing, validating with exactly one chill room', () => {
      const base = studio();
      // 1. Add normal wing
      const normal = addWing(base, 'RIGHT', 'seed-normal', 1);
      expect(validateLayout(normal.layout)).toEqual([]);
      expect(normal.wing.deskCount).toBe(8);
      // 2. Add chill wing
      const chill = addWing(normal.layout, 'BOTTOM', 'seed-chill', 2, { special: 'chill' });
      expect(validateLayout(chill.layout)).toEqual([]);
      expect(chill.wing.deskCount).toBe(0);
      const chillRooms = chill.layout.rooms.filter((r) => r.kind === 'chill');
      expect(chillRooms).toHaveLength(1);
      expect(chillRooms[0].name).toBe('Chill room');
      expect(chill.layout.furniture.filter((f) => f.kind === 'foosball')).toHaveLength(1);
      expect(chill.layout.furniture.filter((f) => f.kind === 'cardTable')).toHaveLength(1);
      expect(chill.layout.furniture.filter((f) => f.kind === 'legoBoard')).toHaveLength(1);
    });

    it('adds chill wing to a generated office, validating with exactly one chill room', () => {
      const base = generatedOffice(8, 'seed-gen');
      const res = addWing(base, 'RIGHT', 'seed-chill-gen', 1, { special: 'chill' });
      expect(validateLayout(res.layout)).toEqual([]);
      expect(res.wing.deskCount).toBe(0);
      const chillRooms = res.layout.rooms.filter((r) => r.kind === 'chill');
      expect(chillRooms).toHaveLength(1);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { numberedDesks } from '../layout/geometry';
import { validateLayout } from '../layout/validate';
import { generatedOffice } from './generated';

const SEEDS = ['Pixel Studio', 'acme', 'clx1y2z3a0000qwerty'];
const SIZES = Array.from({ length: 100 }, (_, i) => i + 1);
const meetingRooms = (team: number, seed: string) => generatedOffice(team, seed).rooms.filter((r) => r.kind === 'meeting').length;

describe('generatedOffice', () => {
  describe.each(SEEDS)('seed %s', (seed) => {
    it.each(SIZES)('works for a team of %i', (team) => {
      const layout = generatedOffice(team, seed);
      expect(validateLayout(layout)).toEqual([]);
      const desks = numberedDesks(layout).length;
      expect(desks).toBeGreaterThanOrEqual(Math.max(4, Math.ceil(team * 1.25)));
      const ids = layout.furniture.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(layout.rooms.map((r) => r.id)).size).toBe(layout.rooms.length);
    });

    it('grows with the team', () => {
      for (let team = 2; team <= 100; team++) {
        expect(meetingRooms(team, seed)).toBeGreaterThanOrEqual(meetingRooms(team - 1, seed));
        expect(generatedOffice(team, seed).width * generatedOffice(team, seed).height).toBeGreaterThanOrEqual(
          generatedOffice(team - 1, seed).width * generatedOffice(team - 1, seed).height,
        );
      }
      expect(meetingRooms(1, seed)).toBe(1);
      expect(meetingRooms(100, seed)).toBe(4);
    });
  });

  it('is the same office for the same team and seed', () => {
    expect(generatedOffice(12, 'acme')).toEqual(generatedOffice(12, 'acme'));
  });

  it('looks different with another seed', () => {
    const looks = new Set(SEEDS.map((seed) => JSON.stringify(generatedOffice(30, seed))));
    expect(looks.size).toBe(SEEDS.length);
  });
});

import { describe, expect, it } from 'vitest';
import { numberedDesks } from '../layout/geometry';
import { validateLayout } from '../layout/validate';
import { generatedOffice } from './generated';
import { loft } from './loft';
import { TEMPLATES } from './index';

describe.each(TEMPLATES)('template $id', (template) => {
  const layout = template.build(template.maxTeam);

  it('passes every editor check', () => {
    expect(validateLayout(layout)).toEqual([]);
  });

  it('has unique furniture ids', () => {
    const ids = layout.furniture.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has enough desks for its biggest team', () => {
    expect(numberedDesks(layout).length).toBeGreaterThanOrEqual(template.maxTeam);
  });

  it('contains exactly one board', () => {
    expect(layout.furniture.filter((f) => f.kind === 'board')).toHaveLength(1);
  });
});

describe('loft chill room', () => {
  const layout = loft();

  it('has exactly one chill room with foosball, cardTable, legoBoard and at least 6 seats near the table', () => {
    const chillRooms = layout.rooms.filter((r) => r.kind === 'chill');
    expect(chillRooms).toHaveLength(1);
    expect(chillRooms[0].id).toBe('chill');
    expect(chillRooms[0].name).toBe('Chill room');

    const foosball = layout.furniture.filter((f) => f.kind === 'foosball');
    expect(foosball).toHaveLength(1);

    const cardTable = layout.furniture.filter((f) => f.kind === 'cardTable');
    expect(cardTable).toHaveLength(1);

    const legoBoard = layout.furniture.filter((f) => f.kind === 'legoBoard');
    expect(legoBoard).toHaveLength(1);

    const table = cardTable[0];
    const seatsNearTable = layout.furniture.filter(
      (f) => (f.kind === 'chair' || f.kind === 'stool') && Math.hypot(f.x - table.x, f.y - table.y) <= 2.5,
    );
    expect(seatsNearTable.length).toBeGreaterThanOrEqual(6);
  });
});

describe('generated office board count and validation', () => {
  it.each([4, 8, 20, 40])('has exactly one board and validates for size %i', (size) => {
    const layout = generatedOffice(size, 'office');
    expect(layout.furniture.filter((f) => f.kind === 'board')).toHaveLength(1);
    expect(validateLayout(layout)).toEqual([]);
  });
});

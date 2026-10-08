import { describe, expect, it } from 'vitest';
import { migrateWallMounted } from './migrate';
import { studio } from '../templates/studio';
import type { Furniture, OfficeLayout } from './types';

describe('migrateWallMounted', () => {
  it('snaps a board off by 2 tiles onto the nearest solid face wall', () => {
    // studio has a solid wall at y=12 from x 29 to 35. Canonical y is 12.40625.
    const base = studio();
    const board: Furniture = { id: 'board-off', kind: 'board', x: 32, y: 14.40625, w: 3, h: 0.5 };
    const layout: OfficeLayout = {
      ...base,
      furniture: [...base.furniture.filter((f) => f.kind !== 'board'), board],
    };

    const res = migrateWallMounted(layout);
    expect(res.changed).toBe(true);
    expect(res.dropped).toEqual([]);
    const migratedBoard = res.layout.furniture.find((f) => f.id === 'board-off');
    expect(migratedBoard).toBeDefined();
    expect(migratedBoard!.y).toBeCloseTo(12.40625, 4);
    expect(migratedBoard!.x).toBe(32);
  });

  it('drops an item with no face wall nearby', () => {
    const layout: OfficeLayout = {
      width: 40,
      height: 40,
      rooms: [],
      walls: [
        // Horizontal wall, but with face: false
        { x1: 0, y1: 20, x2: 40, y2: 20, kind: 'solid', face: false },
        // Glass wall (not solid)
        { x1: 0, y1: 30, x2: 40, y2: 30, kind: 'glass' },
      ],
      furniture: [{ id: 'tv-orphan', kind: 'tv', x: 20, y: 20.5, w: 2, h: 0.28 }],
      spawn: { x: 5, y: 5 },
    };

    const res = migrateWallMounted(layout);
    expect(res.changed).toBe(true);
    expect(res.dropped).toEqual(['tv-orphan']);
    expect(res.layout.furniture.find((f) => f.id === 'tv-orphan')).toBeUndefined();
  });

  it('is idempotent on an already-migrated layout', () => {
    const base = studio();
    const board: Furniture = { id: 'board-off', kind: 'board', x: 32, y: 14.40625, w: 3, h: 0.5 };
    const layout: OfficeLayout = {
      ...base,
      furniture: [...base.furniture.filter((f) => f.kind !== 'board'), board],
    };

    const first = migrateWallMounted(layout);
    expect(first.changed).toBe(true);

    const second = migrateWallMounted(first.layout);
    expect(second.changed).toBe(false);
    expect(second.dropped).toEqual([]);
    expect(second.layout.furniture).toEqual(first.layout.furniture);
  });
});

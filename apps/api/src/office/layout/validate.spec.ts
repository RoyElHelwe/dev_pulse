import { describe, expect, it } from 'vitest';
import { studio } from '../templates/studio';
import { validateLayout } from './validate';
import type { Furniture, OfficeLayout } from './types';

const codes = (layout: OfficeLayout) => validateLayout(layout).map((p) => p.code);
const withFurniture = (extra: Furniture[], base = studio()) => ({ ...base, furniture: [...base.furniture, ...extra] });

describe('validateLayout', () => {
  it('rejects furniture outside the building', () => {
    expect(codes(withFurniture([{ id: 'p', kind: 'plant', x: 47, y: 20, w: 1, h: 1 }]))).toContain('OUTSIDE');
  });

  it('rejects a desk on a wall', () => {
    expect(codes(withFurniture([{ id: 'd', kind: 'desk', x: 30, y: 12, w: 3, h: 1.5 }]))).toContain('ON_WALL');
  });

  it('rejects overlapping furniture but allows a rug under a sofa', () => {
    const base = studio();
    const desk = base.furniture.find((f) => f.kind === 'desk')!;
    expect(codes(withFurniture([{ ...desk, id: 'copy', x: desk.x + 1 }], base))).toContain('OVERLAP');
    expect(codes(withFurniture([{ id: 'r', kind: 'rug', x: desk.x, y: desk.y, w: 4, h: 3 }], base))).toEqual([]);
  });

  it('rejects a blocked door (meeting room unreachable)', () => {
    // Atlas' door is between x 8.5 and 11.5 on the wall at y 12.
    const blocked = withFurniture([{ id: 'b', kind: 'bookshelf', x: 10, y: 13.3, w: 3.4, h: 0.8 }]);
    expect(validateLayout(blocked)).toContainEqual(expect.objectContaining({ code: 'ROOM_UNREACHABLE', message: 'Nobody can walk into Atlas.' }));
  });

  it('rejects a desk boxed in by other furniture', () => {
    const boxed = studio();
    const desk = boxed.furniture.find((f) => f.kind === 'desk' && f.rotation === 0)!;
    // Shelves around the seat in front of this desk.
    boxed.furniture.push(
      { id: 's1', kind: 'bookshelf', x: desk.x, y: desk.y + 2.4, w: 3.2, h: 0.6 },
      { id: 's2', kind: 'bookshelf', x: desk.x - 1.85, y: desk.y + 1.5, w: 0.6, h: 2.4 },
      { id: 's3', kind: 'bookshelf', x: desk.x + 1.85, y: desk.y + 1.5, w: 0.6, h: 2.4 },
    );
    expect(validateLayout(boxed)).toContainEqual(expect.objectContaining({ code: 'DESK_UNREACHABLE', itemIds: [desk.id] }));
  });

  it('rejects a blocked entrance', () => {
    expect(codes(withFurniture([{ id: 'f', kind: 'fridge', x: 23, y: 31.5, w: 1.5, h: 1.3 }]))).toContain('SPAWN_BLOCKED');
  });

  it('allows a board overlapping a wall but rejects two overlapping boards', () => {
    const base = { ...studio(), furniture: studio().furniture.filter((f) => f.kind !== 'board') };
    const board1: Furniture = { id: 'board-1', kind: 'board', x: 32, y: 12, w: 3, h: 0.5 };
    expect(codes(withFurniture([board1], base))).toEqual([]);

    const board2: Furniture = { id: 'board-2', kind: 'board', x: 33, y: 12, w: 3, h: 0.5 };
    expect(codes(withFurniture([board1, board2], base))).toContain('OVERLAP');
  });
});
